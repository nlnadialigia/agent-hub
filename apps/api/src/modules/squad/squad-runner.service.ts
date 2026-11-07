import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentGateway, HumanDecision } from '../gateway/agent.gateway';
import { PolyglotScannerService } from '../repository/polyglot-scanner.service';
import { GitWorktreeService } from '../repository/git-worktree.service';
import { ProvidersManagerService } from '../providers/providers-manager.service';
import { OrchestratorAgent } from './orchestrator.agent';
import { SpecialistAgentsService } from './specialist.agents';

export interface CreateTaskDto {
  cardId: string;
  repositoryId?: string;
  repositoryName?: string;
  taskProvider?: string;
  vcsProvider?: string;
  targetBranch?: string;
  executionMode?: 'SEQUENTIAL' | 'CONCURRENT';
  customInstructions?: string;
}

@Injectable()
export class SquadRunnerService {
  private readonly logger = new Logger(SquadRunnerService.name);
  private isProcessingQueue = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AgentGateway,
    private readonly scanner: PolyglotScannerService,
    private readonly worktreeService: GitWorktreeService,
    private readonly providersManager: ProvidersManagerService,
    private readonly orchestrator: OrchestratorAgent,
    private readonly specialists: SpecialistAgentsService
  ) {}

  /**
   * Cria uma nova tarefa na fila e dispara o fluxo
   */
  async createTask(dto: CreateTaskDto) {
    // 1. Localiza ou escaneia o repositório
    let repository = dto.repositoryId
      ? await this.prisma.repositoryProfile.findUnique({ where: { id: dto.repositoryId } })
      : null;

    if (!repository && dto.repositoryName) {
      repository = await this.prisma.repositoryProfile.findUnique({ where: { name: dto.repositoryName } });
    }

    if (!repository) {
      // Pega o primeiro repositório disponível ou busca no disco
      repository = await this.prisma.repositoryProfile.findFirst({ orderBy: { updatedAt: 'desc' } });
      if (!repository) {
        throw new Error('Nenhum repositório cadastrado. Escaneie um repositório primeiro.');
      }
    }

    const taskProviderType = dto.taskProvider || 'GITHUB_ISSUES';
    const vcsProviderType = dto.vcsProvider || repository.detectedVcs || 'GITHUB';
    const targetBranch = dto.targetBranch || repository.targetBranch || 'main';
    const executionMode = dto.executionMode || 'SEQUENTIAL';

    // 2. Busca informações do card na origem
    this.logger.log(`📥 Buscando informações do card #${dto.cardId} em ${taskProviderType}...`);
    const cardData = await this.providersManager.fetchCard(taskProviderType, dto.cardId);

    // 3. Salva no banco de dados
    const task = await this.prisma.taskExecution.create({
      data: {
        cardId: cardData.cardId,
        cardTitle: cardData.title,
        cardDescription: cardData.description,
        customInstructions: dto.customInstructions || null,
        taskProvider: taskProviderType,
        vcsProvider: vcsProviderType,
        targetBranch,
        executionMode,
        repositoryId: repository.id,
        status: 'QUEUED',
      },
    });

    this.gateway.emitStatus(task.id, 'QUEUED');
    this.gateway.emitLog(task.id, `Tarefa criada e enfileirada no modo ${executionMode}.`, 'info', '🎯 Tech Lead');

    // Se for concomitante ou não houver nada rodando, inicia
    if (executionMode === 'CONCURRENT') {
      this.executeTaskLifecycle(task.id).catch((err) => {
        this.logger.error(`Erro ao executar tarefa concorrente ${task.id}: ${err.message}`);
      });
    } else {
      this.triggerQueueProcessor();
    }

    return task;
  }

  /**
   * Processador de Fila Sequencial
   */
  private async triggerQueueProcessor() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (true) {
        const nextTask = await this.prisma.taskExecution.findFirst({
          where: {
            status: 'QUEUED',
            executionMode: 'SEQUENTIAL',
            isArchived: false,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!nextTask) break;

        await this.executeTaskLifecycle(nextTask.id);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Ciclo de Vida Completo da Tarefa
   */
  async executeTaskLifecycle(taskId: string) {
    const task = await this.prisma.taskExecution.findUnique({
      where: { id: taskId },
      include: { repository: true },
    });

    if (!task) return;

    try {
      // -------------------------------------------------------------
      // ETAPA 1: DIAGNÓSTICO DO TECH LEAD & HUMAN-IN-THE-LOOP
      // -------------------------------------------------------------
      await this.prisma.taskExecution.update({
        where: { id: taskId },
        data: { status: 'PENDING_DIAGNOSTIC' },
      });
      this.gateway.emitStatus(taskId, 'PENDING_DIAGNOSTIC');
      this.gateway.emitLog(taskId, 'Iniciando análise arquitetural e entendimento de regras...', 'info', '🎯 Tech Lead');

      let diagnosticResult = await this.orchestrator.generateDiagnostic({
        cardId: task.cardId,
        cardTitle: task.cardTitle,
        cardDescription: task.cardDescription || '',
        customInstructions: task.customInstructions || undefined,
        repoProfile: task.repository,
      });

      // Atualiza tarefa com o diagnóstico gerado
      await this.prisma.taskExecution.update({
        where: { id: taskId },
        data: {
          diagnosticPlan: diagnosticResult.rawMarkdown,
          assignedAgents: diagnosticResult.assignedSpecialists,
          status: 'WAITING_APPROVAL',
        },
      });

      // Loop de Decisão Humana com Refinamento Iterativo
      let approved = false;
      while (!approved) {
        this.gateway.emitLog(
          taskId,
          'Diagnóstico concluído. Aguardando decisão do desenvolvedor (Aprovar, Rejeitar ou Refinar)...',
          'info',
          '🎯 Tech Lead'
        );

        const decision: HumanDecision = await this.gateway.requestDecision(taskId, diagnosticResult.rawMarkdown);

        if (decision.action === 'REJECT') {
          this.gateway.emitLog(taskId, 'Tarefa rejeitada pelo desenvolvedor.', 'warn', '🎯 Tech Lead');
          await this.prisma.taskExecution.update({
            where: { id: taskId },
            data: { status: 'REJECTED' },
          });
          this.gateway.emitStatus(taskId, 'REJECTED');
          return;
        }

        if (decision.action === 'REFINE') {
          this.gateway.emitLog(
            taskId,
            `Refinamento solicitado: "${decision.feedback}". Ajustando diagnóstico...`,
            'info',
            '🎯 Tech Lead'
          );

          diagnosticResult = await this.orchestrator.generateDiagnostic({
            cardId: task.cardId,
            cardTitle: task.cardTitle,
            cardDescription: task.cardDescription || '',
            customInstructions: task.customInstructions || undefined,
            repoProfile: task.repository,
            previousFeedback: decision.feedback,
            existingDiagnostic: diagnosticResult.rawMarkdown,
          });

          await this.prisma.taskExecution.update({
            where: { id: taskId },
            data: {
              diagnosticPlan: diagnosticResult.rawMarkdown,
              assignedAgents: diagnosticResult.assignedSpecialists,
            },
          });
          continue; // Volta para aguardar aprovação da versão refinada
        }

        if (decision.action === 'APPROVE') {
          approved = true;
          this.gateway.emitLog(taskId, 'Diagnóstico aprovado! Iniciando escalação da Squad...', 'success', '🎯 Tech Lead');
        }
      }

      // -------------------------------------------------------------
      // ETAPA 2: CRIAÇÃO DA WORKTREE ISOLADA & SUBTASKS DO BOARD
      // -------------------------------------------------------------
      await this.prisma.taskExecution.update({
        where: { id: taskId },
        data: { status: 'IMPLEMENTING' },
      });
      this.gateway.emitStatus(taskId, 'IMPLEMENTING');

      const { worktreePath, branchName } = await this.worktreeService.createWorktree(
        task.repository.localPath,
        taskId,
        task.targetBranch
      );

      await this.prisma.taskExecution.update({
        where: { id: taskId },
        data: { worktreePath, branchName },
      });

      // Sincroniza subtasks planejadas no Kanbanize
      const syncedSubtasks: Array<{ id: string; title: string }> = [];
      if (task.taskProvider === 'KANBANIZE' && diagnosticResult.subtasks.length > 0) {
        this.gateway.emitLog(taskId, 'Criando subtasks no card do Kanbanize via REST API v2...', 'info', '📋 Kanbanize');
        for (const subTitle of diagnosticResult.subtasks) {
          const created = await this.providersManager.createSubtask('KANBANIZE', task.cardId, subTitle);
          syncedSubtasks.push(created);
        }
        await this.prisma.taskExecution.update({
          where: { id: taskId },
          data: { boardSubtasks: syncedSubtasks },
        });
      }

      // -------------------------------------------------------------
      // ETAPA 3: ATUAÇÃO DOS AGENTES ESPECIALISTAS
      // -------------------------------------------------------------
      const specialistsMap: Record<string, string> = {
        DATABASE: '🗄️ Database & ORM Specialist',
        BACKEND_NODE: '🟢 Backend Node/TS Specialist',
        BACKEND_PYTHON: '🐍 Backend Python Specialist',
        FRONTEND: '🎨 Frontend Web Specialist',
        QA_DEVOPS: '🧪 QA, E2E & DevOps Specialist',
      };

      const allModifiedFiles: string[] = [];

      for (const role of diagnosticResult.assignedSpecialists) {
        const badge = specialistsMap[role] || `🤖 ${role}`;
        this.gateway.emitLog(taskId, `Escalando ${badge}...`, 'info', badge);

        const result = await this.specialists.executeSpecialist({
          role,
          badge,
          worktreePath,
          cardTitle: task.cardTitle,
          cardDescription: task.cardDescription || '',
          diagnosticPlan: diagnosticResult.rawMarkdown,
          repoProfile: task.repository,
          emitLog: (msg, type) => this.gateway.emitLog(taskId, msg, type, badge),
        });

        allModifiedFiles.push(...result.filesModified);

        // Se houver subtask correspondente no Kanbanize, marca como finalizada
        if (syncedSubtasks.length > 0) {
          const matchSub = syncedSubtasks.find((s) => s.title.toLowerCase().includes(role.toLowerCase()));
          if (matchSub) {
            await this.providersManager.completeSubtask('KANBANIZE', task.cardId, matchSub.id);
            this.gateway.emitLog(taskId, `Subtask #${matchSub.id} concluída no Kanbanize.`, 'success', '📋 Kanbanize');
          }
        }
      }

      // -------------------------------------------------------------
      // ETAPA 4: COMMIT, PUSH & PULL REQUEST
      // -------------------------------------------------------------
      this.gateway.emitLog(taskId, `Realizando commit na branch '${branchName}'...`, 'info', '🌿 Git');
      const commitMsg = `feat(#${task.cardId}): ${task.cardTitle}`;
      await this.worktreeService.commitAndPush(worktreePath, commitMsg, branchName);

      this.gateway.emitLog(
        taskId,
        `Abrindo Pull Request apontando para '${task.targetBranch}' via ${task.vcsProvider}...`,
        'info',
        '🦊 VCS'
      );

      const prResult = await this.providersManager.createPullRequest(task.vcsProvider, {
        repoPath: worktreePath,
        sourceBranch: branchName,
        targetBranch: task.targetBranch,
        title: `feat(#${task.cardId}): ${task.cardTitle}`,
        description: `Implementação automatizada pela Squad Agent Hub.\n\n${diagnosticResult.summary}`,
        issueNumberToClose: task.cardId,
      });

      this.gateway.emitLog(taskId, `PR criado com sucesso: ${prResult.url}`, 'success', '🦊 VCS');

      // -------------------------------------------------------------
      // ETAPA 5: GERAÇÃO DO RELATÓRIO SIMPLES DE ENTREGA COPIÁVEL
      // -------------------------------------------------------------
      const deliveryReport = this.buildDeliveryReport({
        cardId: task.cardId,
        cardTitle: task.cardTitle,
        prUrl: prResult.url,
        targetBranch: task.targetBranch,
        filesModified: Array.from(new Set(allModifiedFiles)),
        subtasks: diagnosticResult.subtasks,
        summary: diagnosticResult.summary,
      });

      // Finaliza a tarefa no banco
      await this.prisma.taskExecution.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          pullRequestUrl: prResult.url,
          deliveryReport,
        },
      });

      this.gateway.emitStatus(taskId, 'COMPLETED', { prUrl: prResult.url, deliveryReport });
      this.gateway.emitLog(taskId, '🎉 Tarefa concluída com sucesso pela Squad!', 'success', '🎯 Tech Lead');

      // Limpeza da worktree
      await this.worktreeService.removeWorktree(task.repository.localPath, worktreePath);
    } catch (error: any) {
      this.logger.error(`Falha fatal na execução da tarefa ${taskId}: ${error.message}`);
      await this.prisma.taskExecution.update({
        where: { id: taskId },
        data: { status: 'FAILED' },
      });
      this.gateway.emitStatus(taskId, 'FAILED', { error: error.message });
      this.gateway.emitLog(taskId, `Falha na execução: ${error.message}`, 'error', '🎯 Tech Lead');
    }
  }

  /**
   * Constrói o Relatório Simples de Entrega Copiável
   */
  private buildDeliveryReport(data: {
    cardId: string;
    cardTitle: string;
    prUrl: string;
    targetBranch: string;
    filesModified: string[];
    subtasks: string[];
    summary: string;
  }): string {
    return `
# 📄 Relatório Simples de Entrega da Squad
**Demanda:** #${data.cardId} — ${data.cardTitle}  
**Pull Request:** [${data.prUrl}](${data.prUrl})  
**Branch Alvo:** \`${data.targetBranch}\`  
**Status:** ✅ Concluído com Sucesso

---

## 📌 Resumo do que foi Implementado
${data.summary}

---

## 📁 Arquivos Criados ou Alterados
${data.filesModified.length > 0 ? data.filesModified.map((f) => `- \`${f}\``).join('\n') : '- Nenhum arquivo gravado no repositório.'}

---

## 📋 Tasks para o Kanbanize / Businessmap
${data.subtasks.map((s, idx) => `${idx + 1}. [x] ${s}`).join('\n')}
`.trim();
  }

  /**
   * Soft-delete e restauração de tarefas do histórico
   */
  async archiveTask(id: string) {
    return this.prisma.taskExecution.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async restoreTask(id: string) {
    return this.prisma.taskExecution.update({
      where: { id },
      data: { isArchived: false },
    });
  }

  async listTasks(includeArchived = false) {
    return this.prisma.taskExecution.findMany({
      where: includeArchived ? {} : { isArchived: false },
      orderBy: { createdAt: 'desc' },
      include: { repository: { select: { name: true, targetBranch: true } } },
    });
  }

  async getTask(id: string) {
    return this.prisma.taskExecution.findUnique({
      where: { id },
      include: { repository: true },
    });
  }
}
