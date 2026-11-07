import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ProvidersManagerService } from './providers-manager.service';
import { PullRequestInput } from './vcs-providers/vcs-provider.interface';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersManager: ProvidersManagerService) {}

  @Post('fetch-card')
  async fetchCard(
    @Body()
    body: {
      providerType: string;
      cardId: string;
    }
  ) {
    if (!body.cardId) {
      throw new HttpException('cardId é obrigatório', HttpStatus.BAD_REQUEST);
    }
    return this.providersManager.fetchCard(body.providerType, body.cardId);
  }

  @Post('test-connection')
  async testConnection(
    @Body()
    body: {
      category: 'TASK_PROVIDER' | 'VCS_PROVIDER';
      providerType: string;
      config?: Record<string, string>;
    }
  ) {
    if (!body.category || !body.providerType) {
      throw new HttpException('category e providerType são obrigatórios', HttpStatus.BAD_REQUEST);
    }
    return this.providersManager.testConnection(body.category, body.providerType, body.config);
  }

  @Post('detect-vcs')
  detectVcs(@Body() body: { remoteUrl?: string }) {
    return this.providersManager.detectVcsFromRemote(body.remoteUrl);
  }

  @Post('pull-request')
  async createPullRequest(
    @Body()
    body: {
      vcsType: string;
      input: PullRequestInput;
    }
  ) {
    if (!body.vcsType || !body.input) {
      throw new HttpException('vcsType e input são obrigatórios', HttpStatus.BAD_REQUEST);
    }
    return this.providersManager.createPullRequest(body.vcsType, body.input);
  }
}
