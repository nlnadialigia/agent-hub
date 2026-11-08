import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProvidersManagerService } from '../providers/providers-manager.service';
import { execa } from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface PolyglotProfileResult {
  id?: string;
  name: string;
  localPath: string;
  remoteUrl: string | null;
  detectedVcs: string;
  targetBranch: string;
  lastCommitHash: string;
  lastAnalyzedAt: Date;
  stacks: string[];
  primaryLanguage: string;
  frameworks: Record<string, string>;
  packageManagers: string[];
  orm: string | null;
  validationLibs: string[];
  testFrameworks: string[];
  directoryLayout: Record<string, boolean>;
  codingStandards: Record<string, any>;
  isCached: boolean;
}

@Injectable()
export class PolyglotScannerService {
  private readonly logger = new Logger(PolyglotScannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providersManager: ProvidersManagerService
  ) {}

  /**
   * Resolve um caminho de repositório ou pasta pai (seja caminho absoluto do host,
   * relativo ou interno do container) para o caminho montado correspondente dentro do container Docker.
   */
  async resolvePath(targetPath: string): Promise<string> {
    const raw = targetPath.trim();
    const reposBase = process.env.REPOS_BASE_DIR || '/workspace/repos';
    const hostReposPath = process.env.HOST_REPOS_PATH?.trim();

    const candidates: string[] = [];

    // 1. Expandir ~ para a home padrão do usuário no host caso seja fornecido
    const expanded = raw.startsWith('~')
      ? raw.replace(/^~/, '/home/nlnadialigia')
      : raw;

    // Prioridade 1: Testar o caminho diretamente (caso já exista no container exatamente onde apontado)
    candidates.push(path.resolve(expanded));

    // Prioridade 2: Se HOST_REPOS_PATH estiver configurado e o usuário forneceu um caminho sob ele
    if (hostReposPath) {
      const cleanHost = path.resolve(hostReposPath);
      const cleanTarget = path.resolve(expanded);

      if (cleanTarget === cleanHost) {
        // O usuário apontou exatamente para a raiz configurada em HOST_REPOS_PATH
        candidates.push(reposBase);
      } else if (cleanTarget.startsWith(cleanHost + path.sep)) {
        // O usuário apontou para um subdiretório dentro de HOST_REPOS_PATH
        const sub = path.relative(cleanHost, cleanTarget);
        candidates.push(path.join(reposBase, sub));
      }
    }

    // Prioridade 3: Caminhos relativos à raiz de repositórios (/workspace/repos)
    const strippedLeadingSlash = expanded.replace(/^\/+/, '');
    candidates.push(path.join(reposBase, expanded));
    candidates.push(path.join(reposBase, strippedLeadingSlash));

    // 4. Percorrer os candidatos em ordem e retornar o primeiro que realmente existir no filesystem
    for (const candidate of candidates) {
      if (await fs.pathExists(candidate)) {
        this.logger.log(`📍 [Path Resolver] '${raw}' resolvido com sucesso para '${candidate}'`);
        return candidate;
      }
    }

    throw new Error(
      `Diretório não encontrado: ${raw}. Caminhos verificados no container: ${Array.from(new Set(candidates)).join(', ')}`
    );
  }

  /**
   * Escaneia e constrói o perfil poliglota completo de um repositório
   */
  async scanRepository(repoPath: string, repoName?: string, forceScan = false): Promise<PolyglotProfileResult> {
    const resolvedPath = await this.resolvePath(repoPath);

    const inferredName = repoName || path.basename(resolvedPath);

    // 1. Obter hash atual do commit e URL remota via Git
    let currentCommit = 'unknown';
    let remoteUrl: string | null = null;
    try {
      const { stdout: commitOut } = await execa('git', ['rev-parse', 'HEAD'], { cwd: resolvedPath });
      currentCommit = commitOut.trim();
    } catch (err: any) {
      this.logger.warn(`Não foi possível ler git commit em ${resolvedPath}: ${err.message}`);
    }

    try {
      const { stdout: remoteOut } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: resolvedPath });
      remoteUrl = remoteOut.trim() || null;
    } catch {
      // Remote não configurado
    }

    // Auto-detecção de VCS e branch alvo recomendada
    const { provider: detectedVcs, defaultTargetBranch } = this.providersManager.detectVcsFromRemote(remoteUrl);

    // 2. Verificar cache no banco
    if (!forceScan && currentCommit !== 'unknown') {
      try {
        const cached = await this.prisma.repositoryProfile.findUnique({
          where: { name: inferredName },
        });

        if (cached && cached.lastCommitHash === currentCommit) {
          this.logger.log(`⚡ [Cache Hit] Perfil poliglota do repositório '${inferredName}' reutilizado do banco.`);
          return {
            id: cached.id,
            name: cached.name,
            localPath: cached.localPath,
            remoteUrl: cached.remoteUrl,
            detectedVcs: cached.detectedVcs,
            targetBranch: cached.targetBranch,
            lastCommitHash: cached.lastCommitHash,
            lastAnalyzedAt: cached.lastAnalyzedAt,
            stacks: cached.stacks as string[],
            primaryLanguage: cached.primaryLanguage,
            frameworks: cached.frameworks as Record<string, string>,
            packageManagers: cached.packageManagers as string[],
            orm: cached.orm,
            validationLibs: cached.validationLibs as string[],
            testFrameworks: cached.testFrameworks as string[],
            directoryLayout: cached.directoryLayout as Record<string, boolean>,
            codingStandards: cached.codingStandards as Record<string, any>,
            isCached: true,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Falha na leitura do cache: ${err.message}. Prosseguindo com escaneamento...`);
      }
    }

    // 3. Executar escaneamento poliglota
    this.logger.log(`🔍 [Polyglot Scanner] Analisando arquitetura em '${resolvedPath}'...`);

    const stacks: Set<string> = new Set();
    const frameworks: Record<string, string> = {};
    const packageManagers: Set<string> = new Set();
    const validationLibs: Set<string> = new Set();
    const testFrameworks: Set<string> = new Set();
    let orm: string | null = null;

    // --- Análise Node.js / TypeScript ---
    const packageJsonPath = path.join(resolvedPath, 'package.json');
    let hasNode = false;
    let hasTs = await fs.pathExists(path.join(resolvedPath, 'tsconfig.json'));

    if (await fs.pathExists(packageJsonPath)) {
      hasNode = true;
      stacks.add('NODE_TS');
      const pkg = await fs.readJson(packageJsonPath).catch(() => ({}));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      // Frameworks Backend Node
      if (allDeps['@nestjs/core']) {
        frameworks.backend = 'NestJS';
      } else if (allDeps['fastify']) {
        frameworks.backend = 'Fastify';
      } else if (allDeps['express']) {
        frameworks.backend = 'Express';
      }

      // Frameworks Frontend Web
      if (allDeps['next']) {
        frameworks.frontend = 'Next.js';
        stacks.add('REACT');
        stacks.add('FRONTEND');
      } else if (allDeps['react']) {
        frameworks.frontend = allDeps['vite'] ? 'React / Vite' : 'React';
        stacks.add('REACT');
        stacks.add('FRONTEND');
      } else if (allDeps['vue']) {
        frameworks.frontend = 'Vue.js';
        stacks.add('FRONTEND');
      } else if (allDeps['@angular/core']) {
        frameworks.frontend = 'Angular';
        stacks.add('FRONTEND');
      }

      if (allDeps['tailwindcss']) stacks.add('TAILWIND');

      // ORMs
      if (allDeps['@prisma/client'] || (await fs.pathExists(path.join(resolvedPath, 'prisma/schema.prisma')))) {
        orm = 'Prisma';
        stacks.add('PRISMA');
      } else if (allDeps['drizzle-orm']) {
        orm = 'Drizzle';
        stacks.add('DRIZZLE');
      } else if (allDeps['typeorm']) {
        orm = 'TypeORM';
      }

      // Validação
      if (allDeps['zod']) validationLibs.add('Zod');
      if (allDeps['class-validator']) validationLibs.add('class-validator');

      // Testes
      if (allDeps['jest']) testFrameworks.add('Jest');
      if (allDeps['vitest']) testFrameworks.add('Vitest');
      if (allDeps['@playwright/test']) testFrameworks.add('Playwright');
      if (allDeps['cypress']) testFrameworks.add('Cypress');

      // Package Manager
      if (await fs.pathExists(path.join(resolvedPath, 'pnpm-lock.yaml'))) packageManagers.add('pnpm');
      else if (await fs.pathExists(path.join(resolvedPath, 'yarn.lock'))) packageManagers.add('yarn');
      else if (await fs.pathExists(path.join(resolvedPath, 'package-lock.json'))) packageManagers.add('npm');
      else packageManagers.add('pnpm');
    }

    // --- Análise Python ---
    const pyprojectPath = path.join(resolvedPath, 'pyproject.toml');
    const requirementsPath = path.join(resolvedPath, 'requirements.txt');
    let hasPython = false;

    if ((await fs.pathExists(pyprojectPath)) || (await fs.pathExists(requirementsPath))) {
      hasPython = true;
      stacks.add('PYTHON');

      let pyContent = '';
      if (await fs.pathExists(pyprojectPath)) {
        pyContent += await fs.readFile(pyprojectPath, 'utf8');
      }
      if (await fs.pathExists(requirementsPath)) {
        pyContent += await fs.readFile(requirementsPath, 'utf8');
      }

      if (pyContent.includes('fastapi')) frameworks.python = 'FastAPI';
      else if (pyContent.includes('django')) frameworks.python = 'Django';
      else if (pyContent.includes('flask')) frameworks.python = 'Flask';

      if (pyContent.includes('pydantic')) validationLibs.add('Pydantic');
      if (pyContent.includes('pytest')) testFrameworks.add('Pytest');
      if (pyContent.includes('sqlalchemy')) {
        orm = orm ? `${orm} + SQLAlchemy` : 'SQLAlchemy';
      }

      if (await fs.pathExists(path.join(resolvedPath, 'poetry.lock'))) packageManagers.add('poetry');
      else if (await fs.pathExists(path.join(resolvedPath, 'uv.lock'))) packageManagers.add('uv');
      else packageManagers.add('pip');
    }

    // --- Análise DevOps / Infra ---
    if ((await fs.pathExists(path.join(resolvedPath, 'Dockerfile'))) || (await fs.pathExists(path.join(resolvedPath, 'docker-compose.yml')))) {
      stacks.add('DOCKER');
    }
    if (await fs.pathExists(path.join(resolvedPath, '.github/workflows'))) {
      stacks.add('GITHUB_ACTIONS');
    }

    // Determina linguagem primária
    let primaryLanguage = 'Polyglot';
    if (hasNode && !hasPython) primaryLanguage = hasTs ? 'TypeScript' : 'JavaScript';
    else if (hasPython && !hasNode) primaryLanguage = 'Python';
    else if (!hasNode && !hasPython) primaryLanguage = 'General Code';

    // Layout de Diretórios
    const layout = {
      hasSrc: await fs.pathExists(path.join(resolvedPath, 'src')),
      hasApps: await fs.pathExists(path.join(resolvedPath, 'apps')),
      hasPrisma: await fs.pathExists(path.join(resolvedPath, 'prisma')),
      hasTests: (await fs.pathExists(path.join(resolvedPath, 'tests'))) || (await fs.pathExists(path.join(resolvedPath, 'test'))),
      hasDocker: await fs.pathExists(path.join(resolvedPath, 'Dockerfile')),
      hasWorkflows: await fs.pathExists(path.join(resolvedPath, '.github/workflows')),
    };

    const targetBranch = defaultTargetBranch;

    // 4. Salvar ou atualizar no banco
    const profile = await this.prisma.repositoryProfile.upsert({
      where: { name: inferredName },
      update: {
        localPath: resolvedPath,
        remoteUrl,
        detectedVcs,
        targetBranch,
        lastCommitHash: currentCommit,
        lastAnalyzedAt: new Date(),
        stacks: Array.from(stacks),
        primaryLanguage,
        frameworks,
        packageManagers: Array.from(packageManagers),
        orm,
        validationLibs: Array.from(validationLibs),
        testFrameworks: Array.from(testFrameworks),
        directoryLayout: layout,
        codingStandards: { strictNullChecks: true, formatOnSave: true },
      },
      create: {
        name: inferredName,
        localPath: resolvedPath,
        remoteUrl,
        detectedVcs,
        targetBranch,
        lastCommitHash: currentCommit,
        lastAnalyzedAt: new Date(),
        stacks: Array.from(stacks),
        primaryLanguage,
        frameworks,
        packageManagers: Array.from(packageManagers),
        orm,
        validationLibs: Array.from(validationLibs),
        testFrameworks: Array.from(testFrameworks),
        directoryLayout: layout,
        codingStandards: { strictNullChecks: true, formatOnSave: true },
      },
    });

    return {
      id: profile.id,
      name: profile.name,
      localPath: profile.localPath,
      remoteUrl: profile.remoteUrl,
      detectedVcs: profile.detectedVcs,
      targetBranch: profile.targetBranch,
      lastCommitHash: profile.lastCommitHash,
      lastAnalyzedAt: profile.lastAnalyzedAt,
      stacks: profile.stacks as string[],
      primaryLanguage: profile.primaryLanguage,
      frameworks: profile.frameworks as Record<string, string>,
      packageManagers: profile.packageManagers as string[],
      orm: profile.orm,
      validationLibs: profile.validationLibs as string[],
      testFrameworks: profile.testFrameworks as string[],
      directoryLayout: profile.directoryLayout as Record<string, boolean>,
      codingStandards: profile.codingStandards as Record<string, any>,
      isCached: false,
    };
  }

  /**
   * Lista todos os perfis escaneados salvos no banco
   */
  async listRepositories() {
    return this.prisma.repositoryProfile.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        tasks: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, cardId: true, cardTitle: true, status: true, pullRequestUrl: true },
        },
      },
    });
  }

  /**
   * Atualiza a targetBranch de um repositório
   */
  async updateRepositoryTargetBranch(id: string, targetBranch: string) {
    return this.prisma.repositoryProfile.update({
      where: { id },
      data: { targetBranch },
    });
  }

  /**
   * Escaneia uma pasta pai e descobre automaticamente todos os repositórios Git existentes nela
   */
  async scanDirectory(parentPath: string): Promise<{ parentPath: string; scannedCount: number; repositories: PolyglotProfileResult[] }> {
    const resolvedParent = await this.resolvePath(parentPath);

    this.logger.log(`📂 [Batch Scanner] Buscando repositórios dentro de '${resolvedParent}'...`);
    const entries = await fs.readdir(resolvedParent, { withFileTypes: true });
    const scannedRepos: PolyglotProfileResult[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullSubPath = path.join(resolvedParent, entry.name);
        const hasGit = await fs.pathExists(path.join(fullSubPath, '.git'));
        const hasManifest =
          (await fs.pathExists(path.join(fullSubPath, 'package.json'))) ||
          (await fs.pathExists(path.join(fullSubPath, 'pyproject.toml')));

        if (hasGit || hasManifest) {
          try {
            this.logger.log(`🔍 [Batch Scanner] Encontrado repositório em '${entry.name}'. Escaneando...`);
            const result = await this.scanRepository(fullSubPath, entry.name, true);
            scannedRepos.push(result);
          } catch (err: any) {
            this.logger.warn(`Erro ao escanear subpasta '${entry.name}': ${err.message}`);
          }
        }
      }
    }

    return {
      parentPath: resolvedParent,
      scannedCount: scannedRepos.length,
      repositories: scannedRepos,
    };
  }
}
