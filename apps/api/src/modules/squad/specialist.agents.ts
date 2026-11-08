import { Injectable, Logger } from '@nestjs/common';
import { OmniRouteService, ChatMessage } from '../omniroute/omniroute.service';
import { execa } from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface SpecialistExecutionInput {
  taskId?: string;
  role: string;
  badge: string;
  worktreePath: string;
  cardTitle: string;
  cardDescription: string;
  diagnosticPlan: string;
  repoProfile: any;
  emitLog: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

export interface SpecialistExecutionResult {
  role: string;
  badge: string;
  success: boolean;
  filesModified: string[];
  summary: string;
}

@Injectable()
export class SpecialistAgentsService {
  private readonly logger = new Logger(SpecialistAgentsService.name);

  constructor(private readonly omniService: OmniRouteService) {}

  /**
   * Executa a etapa do Especialista escalado
   */
  async executeSpecialist(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult> {
    const { taskId, role, badge, worktreePath, cardTitle, diagnosticPlan, repoProfile, emitLog } = input;

    emitLog(`Iniciando atuação na sandbox isolada...`, 'info');

    // Prompt customizado por papel de especialista
    const prompt = `
Você é o ${badge} de uma squad autônoma.
Sua missão é implementar os arquivos necessários da sua especialidade dentro do repositório em worktree.

DEMANDA:
Título: ${cardTitle}
DIAGNÓSTICO ARQUITETURAL DO TECH LEAD:
${diagnosticPlan}

INFORMAÇÕES DO REPOSITÓRIO:
Linguagem: ${repoProfile.primaryLanguage}
Stacks: ${JSON.stringify(repoProfile.stacks)}
Frameworks: ${JSON.stringify(repoProfile.frameworks)}

INSTRUÇÕES OBRIGATÓRIAS:
1. Responda detalhando as alterações e entregue os arquivos completos para gravação.
2. Formate cada arquivo a ser criado ou atualizado no padrão exato:
<<<FILE: caminho/relativo/do/arquivo.ext>>>
(conteúdo completo do arquivo)
<<<END_FILE>>>

3. Não corte código com comentários "adicione aqui". Entregue código executável, tipado e completo.
`;

    const messages: ChatMessage[] = [
      { role: 'system', content: `Você é o ${badge}. Entregue código idiomático de alta performance.` },
      { role: 'user', content: prompt },
    ];

    try {
      const response = await this.omniService.generateCompletion({
        taskId,
        specialistRole: role,
        messages,
        temperature: 0.1,
      });

      emitLog(`Código e especificações geradas pelo modelo ${response.modelUsed}.`, 'info');

      // Grava arquivos na worktree
      const filesModified = await this.extractAndWriteFiles(response.content, worktreePath, emitLog);

      // Tratamento especial para QA & DevOps: Executar Testes & Self-Healing
      if (role === 'QA_DEVOPS') {
        const testSuccess = await this.runQASelfHealingLoop(worktreePath, repoProfile, emitLog, taskId);
        return {
          role,
          badge,
          success: testSuccess,
          filesModified,
          summary: `QA validou os testes com status: ${testSuccess ? 'Aprovado' : 'Atenção necessária'}.`,
        };
      }

      emitLog(`Concluído com sucesso. ${filesModified.length} arquivo(s) modificado(s).`, 'success');
      return {
        role,
        badge,
        success: true,
        filesModified,
        summary: `Especialista concluiu sua etapa alterando ${filesModified.length} arquivo(s).`,
      };
    } catch (err: any) {
      emitLog(`Erro na execução do especialista: ${err.message}`, 'error');
      return {
        role,
        badge,
        success: false,
        filesModified: [],
        summary: `Falha: ${err.message}`,
      };
    }
  }

  /**
   * Extrai blocos <<<FILE: path>>> ... <<<END_FILE>>> e grava no disco
   */
  private async extractAndWriteFiles(
    content: string,
    worktreePath: string,
    emitLog: (msg: string, type?: any) => void
  ): Promise<string[]> {
    const regex = /<<<FILE:\s*([^\n>]+)>>>([\s\S]*?)<<<END_FILE>>>/g;
    const modifiedFiles: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const relativePath = match[1].trim();
      const fileContent = match[2].trimStart();
      const targetPath = path.join(worktreePath, relativePath);

      try {
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, fileContent, 'utf8');
        modifiedFiles.push(relativePath);
        emitLog(`Arquivo gravado: ${relativePath}`, 'info');
      } catch (err: any) {
        emitLog(`Falha ao gravar arquivo ${relativePath}: ${err.message}`, 'warn');
      }
    }

    return modifiedFiles;
  }

  /**
   * Loop de Self-Healing para QA & DevOps (até 3 tentativas)
   */
  private async runQASelfHealingLoop(
    worktreePath: string,
    repoProfile: any,
    emitLog: (msg: string, type?: any) => void,
    taskId?: string
  ): Promise<boolean> {
    emitLog(`Iniciando bateria de validação e testes automatizados...`, 'info');

    let testCmd = 'echo "Nenhum teste configurado"';
    let testArgs: string[] = [];

    if (repoProfile.stacks?.includes('NODE_TS')) {
      testCmd = 'pnpm';
      testArgs = ['test'];
    } else if (repoProfile.stacks?.includes('PYTHON')) {
      testCmd = 'pytest';
      testArgs = ['-v'];
    }

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        emitLog(`[Tentativa ${attempt}/${maxRetries}] Executando '${testCmd} ${testArgs.join(' ')}'...`, 'info');
        const { stdout } = await execa(testCmd, testArgs, { cwd: worktreePath, timeout: 60000 });
        emitLog(`✅ Testes passaram com sucesso!\n${stdout.slice(0, 300)}`, 'success');
        return true;
      } catch (testError: any) {
        const errorOutput = testError.stderr || testError.stdout || testError.message;
        emitLog(`⚠️ Falha nos testes na tentativa ${attempt}: ${errorOutput.slice(0, 200)}...`, 'warn');

        if (attempt === maxRetries) {
          emitLog(`❌ Limite de 3 tentativas de Self-Healing atingido. Registrando para conferência humana.`, 'error');
          return false;
        }

        emitLog(`🤖 Ativando Self-Healing com IA para corrigir a falha...`, 'info');
        const healingPrompt = `
Os testes falharam na tentativa ${attempt} com a seguinte saída de erro:
${errorOutput}

Analise a causa raiz da quebra e forneça a correção do código no formato:
<<<FILE: caminho/do/arquivo>>>
(código corrigido)
<<<END_FILE>>>
`;
        try {
          const healResponse = await this.omniService.generateCompletion({
            taskId,
            specialistRole: 'QA_DEVOPS',
            messages: [{ role: 'user', content: healingPrompt }],
            temperature: 0.1,
          });
          await this.extractAndWriteFiles(healResponse.content, worktreePath, emitLog);
        } catch (healErr: any) {
          emitLog(`Falha ao obter correção da IA: ${healErr.message}`, 'warn');
        }
      }
    }

    return false;
  }
}
