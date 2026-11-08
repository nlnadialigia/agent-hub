import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { execa } from 'execa';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsVaultService } from '../vault/credentials-vault.service';

export interface FailureReportInput {
  taskId: string;
  cardId: string;
  cardTitle: string;
  repositoryName: string;
  failedStage: 'DIAGNOSTIC' | 'IMPLEMENTATION' | 'PR_CREATION';
  errorMessage: string;
  recentLogs?: string[];
}

export interface FailureReportResult {
  created: boolean;
  issueNumber?: number;
  issueUrl?: string;
  reason?: string;
}

@Injectable()
export class FailureIssueReporterService {
  private readonly logger = new Logger(FailureIssueReporterService.name);
  private readonly targetRepo = process.env.FAILURE_REPORT_REPO || 'nlnadialigia/agent-hub';

  constructor(
    private readonly prisma: PrismaService,
    private readonly vaultService: CredentialsVaultService
  ) {}

  /**
   * Cria automaticamente (com trava anti-duplicidade) uma Issue no repositório nlnadialigia/agent-hub
   * quando uma tarefa da Squad sofre falha fatal.
   */
  async reportTaskFailure(input: FailureReportInput): Promise<FailureReportResult> {
    try {
      // 1. Verifica trava anti-duplicidade na própria tarefa
      const task = await this.prisma.taskExecution.findUnique({
        where: { id: input.taskId },
      });

      if (task?.failureIssueUrl && task?.failureIssueNumber) {
        this.logger.log(
          `Tarefa ${input.taskId} já possui Issue de falha vinculada (#${task.failureIssueNumber}). Evitando duplicidade.`
        );
        return {
          created: false,
          issueNumber: task.failureIssueNumber,
          issueUrl: task.failureIssueUrl,
          reason: 'Issue já vinculada a esta tarefa.',
        };
      }

      // 2. Verifica se já existe outra tarefa recente para o mesmo Card e Erro com issue aberta
      const duplicateTask = await this.prisma.taskExecution.findFirst({
        where: {
          cardId: input.cardId,
          failureIssueUrl: { not: null },
          status: 'FAILED',
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (duplicateTask?.failureIssueUrl && duplicateTask?.failureIssueNumber) {
        await this.prisma.taskExecution.update({
          where: { id: input.taskId },
          data: {
            failureIssueUrl: duplicateTask.failureIssueUrl,
            failureIssueNumber: duplicateTask.failureIssueNumber,
          },
        });
        return {
          created: false,
          issueNumber: duplicateTask.failureIssueNumber,
          issueUrl: duplicateTask.failureIssueUrl,
          reason: 'Vinculada à Issue de falha existente para este mesmo Card.',
        };
      }

      const issueTitle = `[Auto-Failure] Card #${input.cardId} (${input.cardTitle}) — Falha em ${input.failedStage}`;
      const logsSection =
        input.recentLogs && input.recentLogs.length > 0
          ? input.recentLogs.slice(-12).join('\n')
          : 'Sem logs adicionais capturados.';

      const issueBody = `
## 🚨 Relatório Automático de Falha na Execução (Agent Hub)

- **Task ID:** \`${input.taskId}\`
- **Demanda Original:** #${input.cardId} — ${input.cardTitle}
- **Repositório Alvo:** \`${input.repositoryName}\`
- **Etapa da Falha:** \`${input.failedStage}\`
- **Data/Hora (UTC):** ${new Date().toISOString()}

---

### ❌ Mensagem de Erro Principal
\`\`\`text
${input.errorMessage}
\`\`\`

### 📜 Últimos Logs do Terminal
\`\`\`text
${logsSection}
\`\`\`

---
*Issue gerada automaticamente pelo \`FailureIssueReporterService\` do Agent Hub.*
`.trim();

      // 3. Tenta criar via GitHub REST API usando token do Cofre ou Ambiente
      const githubVcsConfig = await this.vaultService.getEffectiveConfig('GITHUB');
      const githubIssuesConfig = await this.vaultService.getEffectiveConfig('GITHUB_ISSUES');
      const token =
        githubVcsConfig.token ||
        githubIssuesConfig.token ||
        process.env.GITHUB_TOKEN ||
        '';

      if (token) {
        try {
          const response = await axios.post(
            `https://api.github.com/repos/${this.targetRepo}/issues`,
            {
              title: issueTitle,
              body: issueBody,
              labels: ['bug', 'auto-failure'],
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
              },
              timeout: 10000,
            }
          );

          const issueUrl = response.data.html_url;
          const issueNumber = response.data.number;

          await this.prisma.taskExecution.update({
            where: { id: input.taskId },
            data: {
              failureIssueUrl: issueUrl,
              failureIssueNumber: issueNumber,
            },
          });

          this.logger.log(`✅ Issue de falha #${issueNumber} criada automaticamente: ${issueUrl}`);
          return {
            created: true,
            issueNumber,
            issueUrl,
          };
        } catch (apiErr: any) {
          this.logger.warn(
            `Falha ao criar issue via GitHub REST API (${apiErr.message}). Tentando fallback via GitHub CLI (gh)...`
          );
        }
      }

      // 4. Fallback via GitHub CLI (gh) se instalado e autenticado no ambiente
      try {
        const { stdout } = await execa('gh', [
          'issue',
          'create',
          '--repo',
          this.targetRepo,
          '--title',
          issueTitle,
          '--body',
          issueBody,
        ]);

        const issueUrl = stdout.trim().split('\n').pop()?.trim() || '';
        const matchNum = issueUrl.match(/\/issues\/(\d+)/);
        const issueNumber = matchNum ? parseInt(matchNum[1], 10) : undefined;

        if (issueUrl.startsWith('http')) {
          await this.prisma.taskExecution.update({
            where: { id: input.taskId },
            data: {
              failureIssueUrl: issueUrl,
              failureIssueNumber: issueNumber ?? null,
            },
          });

          this.logger.log(`✅ Issue de falha criada via gh CLI: ${issueUrl}`);
          return {
            created: true,
            issueNumber,
            issueUrl,
          };
        }
      } catch (ghErr: any) {
        this.logger.warn(`Não foi possível criar issue automática via gh CLI: ${ghErr.message}`);
      }

      return {
        created: false,
        reason: 'Sem credenciais GITHUB_TOKEN válidas no Cofre/Ambiente ou gh CLI indisponível.',
      };
    } catch (error: any) {
      this.logger.error(`Erro no FailureIssueReporterService: ${error.message}`);
      return {
        created: false,
        reason: error.message,
      };
    }
  }
}
