export interface PullRequestInput {
  repoPath: string;
  sourceBranch: string;
  targetBranch: string; // Ex: 'develop' no Azure DevOps, 'main' no GitHub
  title: string;
  description: string;
  issueNumberToClose?: string;
}

export interface PullRequestResult {
  id: string;
  url: string;
  provider: string;
  isSimulated: boolean;
}

export interface IVCSProvider {
  readonly providerType: string;
  createPullRequest(input: PullRequestInput, config: Record<string, string>): Promise<PullRequestResult>;
  testConnection(config: Record<string, string>): Promise<{ ok: boolean; message: string }>;
}
