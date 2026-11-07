import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { IVCSProvider, PullRequestInput, PullRequestResult } from './vcs-provider.interface';

@Injectable()
export class GitLabVCSProvider implements IVCSProvider {
  readonly providerType = 'GITLAB';

  async createPullRequest(input: PullRequestInput, config: Record<string, string>): Promise<PullRequestResult> {
    const targetBranch = input.targetBranch || 'main';
    const token = config.token || process.env.GITLAB_TOKEN;
    const baseUrl = config.baseUrl || process.env.GITLAB_BASE_URL || 'https://gitlab.com';

    if (token) {
      try {
        const cleanBase = baseUrl.replace(/\/$/, '');
        const projectId = encodeURIComponent(config.projectId || 'project');
        const res = await axios.post(
          `${cleanBase}/api/v4/projects/${projectId}/merge_requests`,
          {
            source_branch: input.sourceBranch,
            target_branch: targetBranch,
            title: input.title,
            description: input.description,
          },
          {
            headers: { 'PRIVATE-TOKEN': token },
            timeout: 10000,
          }
        );
        return {
          id: String(res.data.iid || res.data.id),
          url: res.data.web_url,
          provider: 'GITLAB',
          isSimulated: false,
        };
      } catch {
        // Fallback
      }
    }

    return {
      id: `SIM-GITLAB-${Date.now()}`,
      url: `${baseUrl}/simulated/project/-/merge_requests/${Date.now()}`,
      provider: 'GITLAB',
      isSimulated: true,
    };
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const token = config.token || process.env.GITLAB_TOKEN;
    const baseUrl = config.baseUrl || 'https://gitlab.com';
    if (!token) return { ok: false, message: 'Token do GitLab não configurado.' };

    try {
      const res = await axios.get(`${baseUrl}/api/v4/user`, {
        headers: { 'PRIVATE-TOKEN': token },
        timeout: 6000,
      });
      return { ok: true, message: `GitLab conectado como @${res.data?.username}.` };
    } catch (err: any) {
      return { ok: false, message: `Erro ao conectar ao GitLab: ${err.message}` };
    }
  }
}
