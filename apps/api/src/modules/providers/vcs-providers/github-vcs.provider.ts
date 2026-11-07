import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { execa } from 'execa';
import { IVCSProvider, PullRequestInput, PullRequestResult } from './vcs-provider.interface';

@Injectable()
export class GitHubVCSProvider implements IVCSProvider {
  readonly providerType = 'GITHUB';
  private readonly logger = new Logger(GitHubVCSProvider.name);

  async createPullRequest(input: PullRequestInput, config: Record<string, string>): Promise<PullRequestResult> {
    const targetBranch = input.targetBranch || 'main';
    const token = config.token || process.env.GITHUB_TOKEN;
    
    let description = input.description;
    if (input.issueNumberToClose) {
      description += `\n\nCloses #${input.issueNumberToClose}`;
    }

    // 1. Tentar via GitHub CLI
    try {
      this.logger.log(`Tentando criar PR via gh CLI para branch ${input.sourceBranch} -> ${targetBranch}...`);
      const { stdout } = await execa(
        'gh',
        [
          'pr',
          'create',
          '--base',
          targetBranch,
          '--head',
          input.sourceBranch,
          '--title',
          input.title,
          '--body',
          description,
        ],
        { cwd: input.repoPath }
      );

      const prUrl = stdout.trim();
      return {
        id: prUrl.split('/').pop() || String(Date.now()),
        url: prUrl,
        provider: 'GITHUB',
        isSimulated: false,
      };
    } catch (ghError: any) {
      this.logger.warn(`gh CLI falhou ou não configurado (${ghError.message}). Tentando fallback via REST API...`);
    }

    // 2. Tentar via GitHub REST API se houver token
    if (token) {
      try {
        const repoFullName = await this.getRepoFullName(input.repoPath);
        if (repoFullName) {
          const res = await axios.post(
            `https://api.github.com/repos/${repoFullName}/pulls`,
            {
              title: input.title,
              head: input.sourceBranch,
              base: targetBranch,
              body: description,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
              },
              timeout: 12000,
            }
          );

          return {
            id: String(res.data.number),
            url: res.data.html_url,
            provider: 'GITHUB',
            isSimulated: false,
          };
        }
      } catch (restError: any) {
        this.logger.error(`Falha também na REST API do GitHub: ${restError.response?.data?.message || restError.message}`);
      }
    }

    // 3. Fallback simulado
    this.logger.warn('GitHub PR em modo simulado (credenciais ausentes ou repositório local).');
    return {
      id: `SIM-${Date.now()}`,
      url: `https://github.com/simulated/repo/pull/${Date.now()}`,
      provider: 'GITHUB',
      isSimulated: true,
    };
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const token = config.token || process.env.GITHUB_TOKEN;
    if (!token) return { ok: false, message: 'Token do GitHub não configurado.' };

    try {
      const res = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 6000,
      });
      return { ok: true, message: `GitHub VCS conectado como @${res.data?.login}.` };
    } catch (err: any) {
      return { ok: false, message: `Erro de autenticação no GitHub: ${err.message}` };
    }
  }

  private async getRepoFullName(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: repoPath });
      const clean = stdout.trim();
      const match = clean.match(/github\.com[:/]([^/]+\/[^/.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
