import { Injectable, Logger } from '@nestjs/common';
import { CredentialsVaultService } from '../vault/credentials-vault.service';
import { ITaskProvider, TaskCard } from './task-providers/task-provider.interface';
import { GitHubIssuesProvider } from './task-providers/github-issues.provider';
import { KanbanizeProvider } from './task-providers/kanbanize.provider';
import { JiraProvider } from './task-providers/jira.provider';
import { TrelloProvider } from './task-providers/trello.provider';
import { LinearProvider } from './task-providers/linear.provider';
import { ManualProvider } from './task-providers/manual.provider';

import { IVCSProvider, PullRequestInput, PullRequestResult } from './vcs-providers/vcs-provider.interface';
import { GitHubVCSProvider } from './vcs-providers/github-vcs.provider';
import { AzureDevOpsVCSProvider } from './vcs-providers/azure-devops-vcs.provider';
import { GitLabVCSProvider } from './vcs-providers/gitlab-vcs.provider';
import { BitbucketVCSProvider } from './vcs-providers/bitbucket-vcs.provider';
import { LocalOnlyVCSProvider } from './vcs-providers/local-only-vcs.provider';

@Injectable()
export class ProvidersManagerService {
  private readonly logger = new Logger(ProvidersManagerService.name);
  private readonly taskProviders = new Map<string, ITaskProvider>();
  private readonly vcsProviders = new Map<string, IVCSProvider>();

  constructor(
    private readonly vaultService: CredentialsVaultService,
    private readonly githubIssues: GitHubIssuesProvider,
    private readonly kanbanize: KanbanizeProvider,
    private readonly jira: JiraProvider,
    private readonly trello: TrelloProvider,
    private readonly linear: LinearProvider,
    private readonly manual: ManualProvider,

    private readonly githubVcs: GitHubVCSProvider,
    private readonly azureDevOpsVcs: AzureDevOpsVCSProvider,
    private readonly gitlabVcs: GitLabVCSProvider,
    private readonly bitbucketVcs: BitbucketVCSProvider,
    private readonly localOnlyVcs: LocalOnlyVCSProvider
  ) {
    // Registra Task Providers
    this.registerTaskProvider(githubIssues);
    this.registerTaskProvider(kanbanize);
    this.registerTaskProvider(jira);
    this.registerTaskProvider(trello);
    this.registerTaskProvider(linear);
    this.registerTaskProvider(manual);

    // Registra VCS Providers
    this.registerVCSProvider(githubVcs);
    this.registerVCSProvider(azureDevOpsVcs);
    this.registerVCSProvider(gitlabVcs);
    this.registerVCSProvider(bitbucketVcs);
    this.registerVCSProvider(localOnlyVcs);
  }

  private registerTaskProvider(provider: ITaskProvider) {
    this.taskProviders.set(provider.providerType.toUpperCase(), provider);
  }

  private registerVCSProvider(provider: IVCSProvider) {
    this.vcsProviders.set(provider.providerType.toUpperCase(), provider);
  }

  getTaskProvider(type: string): ITaskProvider {
    const key = (type || 'GITHUB_ISSUES').toUpperCase();
    const provider = this.taskProviders.get(key);
    if (!provider) {
      this.logger.warn(`Provedor de Tarefa '${type}' não encontrado. Usando Manual.`);
      return this.manual;
    }
    return provider;
  }

  getVCSProvider(type: string): IVCSProvider {
    const key = (type || 'GITHUB').toUpperCase();
    const provider = this.vcsProviders.get(key);
    if (!provider) {
      this.logger.warn(`Provedor VCS '${type}' não encontrado. Usando Local Only.`);
      return this.localOnlyVcs;
    }
    return provider;
  }

  /**
   * Busca os detalhes de um Card no Board escolhido
   */
  async fetchCard(providerType: string, cardId: string): Promise<TaskCard> {
    const provider = this.getTaskProvider(providerType);
    const config = await this.vaultService.getEffectiveConfig(provider.providerType);
    return provider.fetchTask(cardId, config);
  }

  /**
   * Cria uma Subtask no Board (ex: Kanbanize API v2)
   */
  async createSubtask(providerType: string, cardId: string, title: string): Promise<{ id: string; title: string }> {
    const provider = this.getTaskProvider(providerType);
    if (provider.createSubtask) {
      const config = await this.vaultService.getEffectiveConfig(provider.providerType);
      return provider.createSubtask(cardId, title, config);
    }
    return { id: `local-${Date.now()}`, title };
  }

  /**
   * Marca uma Subtask como concluída no Board
   */
  async completeSubtask(providerType: string, cardId: string, subtaskId: string): Promise<boolean> {
    const provider = this.getTaskProvider(providerType);
    if (provider.completeSubtask) {
      const config = await this.vaultService.getEffectiveConfig(provider.providerType);
      return provider.completeSubtask(cardId, subtaskId, config);
    }
    return true;
  }

  /**
   * Abre o Pull Request no Git Provider escolhido
   */
  async createPullRequest(vcsType: string, input: PullRequestInput): Promise<PullRequestResult> {
    const provider = this.getVCSProvider(vcsType);
    const config = await this.vaultService.getEffectiveConfig(provider.providerType);
    return provider.createPullRequest(input, config);
  }

  /**
   * Testa a conexão de qualquer provedor
   */
  async testConnection(
    category: 'TASK_PROVIDER' | 'VCS_PROVIDER',
    providerType: string,
    overrideConfig?: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    const effectiveConfig = overrideConfig && Object.keys(overrideConfig).length > 0
      ? overrideConfig
      : await this.vaultService.getEffectiveConfig(providerType);

    if (category === 'TASK_PROVIDER') {
      const provider = this.getTaskProvider(providerType);
      return provider.testConnection(effectiveConfig);
    } else {
      const provider = this.getVCSProvider(providerType);
      return provider.testConnection(effectiveConfig);
    }
  }

  /**
   * Detecta automaticamente o Git Provider a partir da URL remota do repositório
   */
  detectVcsFromRemote(remoteUrl?: string | null): { provider: string; defaultTargetBranch: string } {
    if (!remoteUrl) {
      return { provider: 'LOCAL_ONLY', defaultTargetBranch: 'main' };
    }

    const lower = remoteUrl.toLowerCase();
    if (lower.includes('azure.com') || lower.includes('visualstudio.com')) {
      return { provider: 'AZURE_DEVOPS', defaultTargetBranch: 'develop' };
    }
    if (lower.includes('github.com')) {
      return { provider: 'GITHUB', defaultTargetBranch: 'main' };
    }
    if (lower.includes('gitlab.com')) {
      return { provider: 'GITLAB', defaultTargetBranch: 'main' };
    }
    if (lower.includes('bitbucket.org')) {
      return { provider: 'BITBUCKET', defaultTargetBranch: 'main' };
    }

    return { provider: 'LOCAL_ONLY', defaultTargetBranch: 'main' };
  }
}
