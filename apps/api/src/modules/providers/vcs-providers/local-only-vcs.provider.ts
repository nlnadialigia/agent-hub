import { Injectable, Logger } from '@nestjs/common';
import { IVCSProvider, PullRequestInput, PullRequestResult } from './vcs-provider.interface';

@Injectable()
export class LocalOnlyVCSProvider implements IVCSProvider {
  readonly providerType = 'LOCAL_ONLY';
  private readonly logger = new Logger(LocalOnlyVCSProvider.name);

  async createPullRequest(input: PullRequestInput, _config: Record<string, string>): Promise<PullRequestResult> {
    this.logger.log(`Branch '${input.sourceBranch}' mantida localmente (Modo Apenas Local ativo).`);
    return {
      id: `LOCAL-${Date.now()}`,
      url: `file://${input.repoPath}#${input.sourceBranch}`,
      provider: 'LOCAL_ONLY',
      isSimulated: false,
    };
  }

  async testConnection(_config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    return {
      ok: true,
      message: 'Provedor Local sempre operacional (não requer credenciais remotas).',
    };
  }
}
