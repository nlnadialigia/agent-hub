import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { execa } from 'execa';
import { IVCSProvider, PullRequestInput, PullRequestResult } from './vcs-provider.interface';

@Injectable()
export class AzureDevOpsVCSProvider implements IVCSProvider {
  readonly providerType = 'AZURE_DEVOPS';
  private readonly logger = new Logger(AzureDevOpsVCSProvider.name);

  async createPullRequest(input: PullRequestInput, config: Record<string, string>): Promise<PullRequestResult> {
    // Para Azure DevOps, a branch alvo padrão comum é develop (ou a informada no input)
    const targetBranch = input.targetBranch || 'develop';
    const orgUrl = config.orgUrl || process.env.AZURE_DEVOPS_ORG_URL;
    const project = config.project || process.env.AZURE_DEVOPS_PROJECT;
    const token = config.token || process.env.AZURE_DEVOPS_TOKEN || process.env.AZURE_DEVOPS_PAT;

    // 1. Tentar via Azure CLI
    try {
      this.logger.log(`Tentando criar PR via az CLI para branch ${input.sourceBranch} -> ${targetBranch}...`);
      const { stdout } = await execa(
        'az',
        [
          'repos',
          'pr',
          'create',
          '--source-branch',
          input.sourceBranch,
          '--target-branch',
          targetBranch,
          '--title',
          input.title,
          '--description',
          input.description,
          '--open',
        ],
        { cwd: input.repoPath }
      );

      const parsed = JSON.parse(stdout);
      return {
        id: String(parsed.pullRequestId || Date.now()),
        url: parsed.url || `${orgUrl}/${project}/_git/pullrequest/${parsed.pullRequestId}`,
        provider: 'AZURE_DEVOPS',
        isSimulated: false,
      };
    } catch (azError: any) {
      this.logger.warn(`Azure CLI falhou ou não configurado (${azError.message}). Tentando fallback via REST API...`);
    }

    // 2. Fallback via REST API do Azure DevOps
    if (orgUrl && project && token) {
      try {
        const repoName = await this.getGitRepoName(input.repoPath);
        const authHeader = `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
        const cleanOrg = orgUrl.replace(/\/$/, '');
        const apiUrl = `${cleanOrg}/${project}/_apis/git/repositories/${repoName}/pullrequests?api-version=7.1`;

        const response = await axios.post(
          apiUrl,
          {
            sourceRefName: `refs/heads/${input.sourceBranch}`,
            targetRefName: `refs/heads/${targetBranch}`,
            title: input.title,
            description: input.description,
          },
          {
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );

        const prData = response.data;
        const webUrl =
          prData?._links?.web?.href ||
          `${cleanOrg}/${project}/_git/${repoName}/pullrequest/${prData.pullRequestId}`;

        return {
          id: String(prData.pullRequestId),
          url: webUrl,
          provider: 'AZURE_DEVOPS',
          isSimulated: false,
        };
      } catch (restError: any) {
        this.logger.error(`Falha na REST API do Azure DevOps: ${restError.response?.data?.message || restError.message}`);
      }
    }

    // 3. Fallback Simulado
    return {
      id: `SIM-AZURE-${Date.now()}`,
      url: `${orgUrl || 'https://dev.azure.com/Org'}/${project || 'Projeto'}/_git/pr/simulated-${Date.now()}`,
      provider: 'AZURE_DEVOPS',
      isSimulated: true,
    };
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const orgUrl = config.orgUrl || process.env.AZURE_DEVOPS_ORG_URL;
    const project = config.project || process.env.AZURE_DEVOPS_PROJECT;
    const token = config.token || process.env.AZURE_DEVOPS_TOKEN || process.env.AZURE_DEVOPS_PAT;

    if (!orgUrl || !token) {
      return { ok: false, message: 'Org URL e Token/PAT do Azure DevOps são obrigatórios.' };
    }

    try {
      const cleanOrg = orgUrl.replace(/\/$/, '');
      const authHeader = `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
      const url = project
        ? `${cleanOrg}/${project}/_apis/git/repositories?api-version=7.1`
        : `${cleanOrg}/_apis/projects?api-version=7.1`;

      const res = await axios.get(url, {
        headers: { Authorization: authHeader },
        timeout: 6000,
      });

      return {
        ok: true,
        message: `Conexão bem-sucedida com Azure DevOps! Encontrados ${res.data?.count ?? 0} repositórios/projetos.`,
      };
    } catch (error: any) {
      return { ok: false, message: `Falha na conexão com Azure DevOps: ${error.message}` };
    }
  }

  private async getGitRepoName(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execa('git', ['config', '--get', 'remote.origin.url'], { cwd: repoPath });
      const parts = stdout.trim().split('/');
      const last = parts[parts.length - 1];
      return last.replace(/\.git$/, '');
    } catch {
      return 'repository';
    }
  }
}
