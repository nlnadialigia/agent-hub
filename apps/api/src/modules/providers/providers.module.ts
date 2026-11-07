import { Module } from '@nestjs/common';
import { VaultModule } from '../vault/vault.module';
import { ProvidersManagerService } from './providers-manager.service';
import { ProvidersController } from './providers.controller';

// Task Providers
import { GitHubIssuesProvider } from './task-providers/github-issues.provider';
import { KanbanizeProvider } from './task-providers/kanbanize.provider';
import { JiraProvider } from './task-providers/jira.provider';
import { TrelloProvider } from './task-providers/trello.provider';
import { LinearProvider } from './task-providers/linear.provider';
import { ManualProvider } from './task-providers/manual.provider';

// VCS Providers
import { GitHubVCSProvider } from './vcs-providers/github-vcs.provider';
import { AzureDevOpsVCSProvider } from './vcs-providers/azure-devops-vcs.provider';
import { GitLabVCSProvider } from './vcs-providers/gitlab-vcs.provider';
import { BitbucketVCSProvider } from './vcs-providers/bitbucket-vcs.provider';
import { LocalOnlyVCSProvider } from './vcs-providers/local-only-vcs.provider';

@Module({
  imports: [VaultModule],
  controllers: [ProvidersController],
  providers: [
    ProvidersManagerService,
    // Task Providers
    GitHubIssuesProvider,
    KanbanizeProvider,
    JiraProvider,
    TrelloProvider,
    LinearProvider,
    ManualProvider,
    // VCS Providers
    GitHubVCSProvider,
    AzureDevOpsVCSProvider,
    GitLabVCSProvider,
    BitbucketVCSProvider,
    LocalOnlyVCSProvider,
  ],
  exports: [ProvidersManagerService],
})
export class ProvidersModule {}
