import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { IVCSProvider, PullRequestInput, PullRequestResult } from './vcs-provider.interface';

@Injectable()
export class BitbucketVCSProvider implements IVCSProvider {
  readonly providerType = 'BITBUCKET';

  async createPullRequest(input: PullRequestInput, config: Record<string, string>): Promise<PullRequestResult> {
    const targetBranch = input.targetBranch || 'main';
    const token = config.token || process.env.BITBUCKET_TOKEN;
    const username = config.username || process.env.BITBUCKET_USERNAME;

    if (token && username && config.workspace && config.repoSlug) {
      try {
        const authHeader = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
        const url = `https://api.bitbucket.org/2.0/repositories/${config.workspace}/${config.repoSlug}/pullrequests`;
        const res = await axios.post(
          url,
          {
            title: input.title,
            description: input.description,
            source: { branch: { name: input.sourceBranch } },
            destination: { branch: { name: targetBranch } },
          },
          {
            headers: { Authorization: authHeader },
            timeout: 10000,
          }
        );

        return {
          id: String(res.data.id),
          url: res.data.links?.html?.href,
          provider: 'BITBUCKET',
          isSimulated: false,
        };
      } catch {
        // Fallback
      }
    }

    return {
      id: `SIM-BITBUCKET-${Date.now()}`,
      url: `https://bitbucket.org/simulated/repo/pull-requests/${Date.now()}`,
      provider: 'BITBUCKET',
      isSimulated: true,
    };
  }

  async testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    const token = config.token || process.env.BITBUCKET_TOKEN;
    const username = config.username || process.env.BITBUCKET_USERNAME;
    if (!token || !username) {
      return { ok: false, message: 'Username e App Password do Bitbucket são obrigatórios.' };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
      const res = await axios.get('https://api.bitbucket.org/2.0/user', {
        headers: { Authorization: authHeader },
        timeout: 6000,
      });
      return { ok: true, message: `Bitbucket conectado como @${res.data?.username}.` };
    } catch (err: any) {
      return { ok: false, message: `Erro ao conectar ao Bitbucket: ${err.message}` };
    }
  }
}
