import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { io, Socket } from 'socket.io-client';
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  AlertCircle,
  ExternalLink,
  CreditCard,
  RotateCcw,
  Bug,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { TerminalLog } from '../TerminalLog';
import { DeliveryReportViewer } from '../DeliveryReportViewer';

interface TaskExecutionTabProps {
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
}

export const TaskExecutionTab: React.FC<TaskExecutionTabProps> = ({ selectedTaskId, onSelectTask }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentTask, setCurrentTask] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [loadingDecision, setLoadingDecision] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Estado para Confirmação de Troca para IA Paga (Issue #8)
  const [fallbackPrompt, setFallbackPrompt] = useState<any | null>(null);
  const [selectedPaidModel, setSelectedPaidModel] = useState<string>('gemini-2.5-pro');
  const [apiKeyOverride, setApiKeyOverride] = useState<string>('');
  const [loadingFallbackDecision, setLoadingFallbackDecision] = useState(false);

  // Estado para Retry direto na aba de Execução
  const [retryingTask, setRetryingTask] = useState(false);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      loadTaskDetails(selectedTaskId);
    } else if (tasks.length > 0 && !currentTask) {
      onSelectTask(tasks[0].id);
      loadTaskDetails(tasks[0].id);
    }
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3334';
    const s = io(wsUrl);
    setSocket(s);

    s.on('task:status', (payload: any) => {
      if (currentTask && payload.taskId === currentTask.id) {
        setCurrentTask((prev: any) => ({
          ...prev,
          status: payload.status,
          errorMessage: payload.metadata?.error || prev?.errorMessage,
          failureIssueUrl: payload.metadata?.failureIssueUrl || prev?.failureIssueUrl,
          failureIssueNumber: payload.metadata?.failureIssueNumber || prev?.failureIssueNumber,
        }));
        if (payload.metadata?.fallbackPrompt) {
          setFallbackPrompt(payload.metadata.fallbackPrompt);
        } else if (payload.status !== 'WAITING_FALLBACK_CONFIRMATION') {
          setFallbackPrompt(null);
        }
      }
    });

    s.on('task:approval_required', (payload: any) => {
      if (currentTask && payload.taskId === currentTask.id) {
        setCurrentTask((prev: any) => ({
          ...prev,
          status: 'WAITING_APPROVAL',
          diagnosticPlan: payload.diagnostic,
        }));
      }
    });

    s.on('task:paid_fallback_required', (payload: any) => {
      if (currentTask && payload.taskId === currentTask.id) {
        setFallbackPrompt(payload);
        setSelectedPaidModel(payload.suggestedPaidModel || 'gemini-2.5-pro');
        setCurrentTask((prev: any) => ({
          ...prev,
          status: 'WAITING_FALLBACK_CONFIRMATION',
        }));
      }
    });

    return () => {
      s.disconnect();
    };
  }, [currentTask?.id]);

  const loadTasks = async () => {
    try {
      const data = await AgentHubApi.getTasks(true);
      setTasks(data);
    } catch {
      // Falha silenciosa
    }
  };

  const loadTaskDetails = async (id: string) => {
    try {
      const task = await AgentHubApi.getTask(id);
      setCurrentTask(task);
      if (task?.pendingFallbackPrompt) {
        setFallbackPrompt(task.pendingFallbackPrompt);
        setSelectedPaidModel(task.pendingFallbackPrompt.suggestedPaidModel || 'gemini-2.5-pro');
      } else if (task?.status !== 'WAITING_FALLBACK_CONFIRMATION') {
        setFallbackPrompt(null);
      }
    } catch {
      // Falha silenciosa
    }
  };

  // Envia decisão humana via WebSocket (Aprovar, Rejeitar ou Refinar Diagnóstico)
  const handleDecision = (action: 'APPROVE' | 'REJECT' | 'REFINE') => {
    if (!socket || !currentTask) return;
    setLoadingDecision(true);

    if (action === 'REFINE' && !feedback.trim()) {
      alert('Por favor, informe suas observações na caixa de feedback para guiar o refinamento.');
      setLoadingDecision(false);
      return;
    }

    socket.emit('task:respond_decision', {
      taskId: currentTask.id,
      decision: {
        action,
        feedback: action === 'REFINE' ? feedback.trim() : undefined,
      },
    });

    if (action === 'REFINE') setFeedback('');
    setLoadingDecision(false);
  };

  // Envia decisão sobre troca para IA Paga quando OmniRoute falhar (Issue #8)
  const handlePaidFallbackDecision = (action: 'APPROVE_ONCE' | 'APPROVE_TASK' | 'DECLINE') => {
    if (!socket || !currentTask) return;

    if (
      (action === 'APPROVE_ONCE' || action === 'APPROVE_TASK') &&
      fallbackPrompt &&
      !fallbackPrompt.hasConfiguredPaidKey &&
      !apiKeyOverride.trim()
    ) {
      alert(
        'Por favor, informe sua chave GEMINI_API_KEY no campo indicado para usar a IA Paga (ela será salva com segurança no Cofre).'
      );
      return;
    }

    setLoadingFallbackDecision(true);
    socket.emit('task:respond_paid_fallback', {
      taskId: currentTask.id,
      action,
      paidModel: selectedPaidModel,
      apiKeyOverride: apiKeyOverride.trim() || undefined,
    });

    setFallbackPrompt(null);
    setApiKeyOverride('');
    setLoadingFallbackDecision(false);
  };

  // Tentar novamente direto da aba de Execução
  const handleQuickRetry = async (allowPaidFallback: boolean) => {
    if (!currentTask) return;
    setRetryingTask(true);
    try {
      const updated = await AgentHubApi.retryTask(currentTask.id, {
        allowPaidFallback,
        resumeFromCheckpoint: Boolean(currentTask.diagnosticPlan),
      });
      setCurrentTask(updated);
      await loadTasks();
    } catch (err: any) {
      alert(`Erro ao tentar novamente: ${err.message}`);
    } finally {
      setRetryingTask(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">✅ Concluído</Badge>;
      case 'WAITING_APPROVAL':
        return <Badge variant="warning">⏳ Aguardando Decisão</Badge>;
      case 'WAITING_FALLBACK_CONFIRMATION':
        return <Badge variant="warning">💳 Aguardando Confirmação IA Paga</Badge>;
      case 'IMPLEMENTING':
        return <Badge variant="cyan">⚡ Implementando</Badge>;
      case 'PENDING_DIAGNOSTIC':
        return <Badge variant="cyan">🔍 Gerando Diagnóstico</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">❌ Reprovado</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">⚠️ Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor Superior de Tarefa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3">
          <PlayCircle className="w-5 h-5 text-cyan-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Selecionar Tarefa:</span>
          <select
            value={currentTask?.id || ''}
            onChange={(e) => onSelectTask(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
          >
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.cardId} — {t.cardTitle} ({t.status})
              </option>
            ))}
          </select>
        </div>

        {currentTask && (
          <div className="flex items-center space-x-2">
            {getStatusBadge(currentTask.status)}
            <Badge variant="outline">{currentTask.taskProvider}</Badge>
            <Badge variant="cyan">{currentTask.vcsProvider}</Badge>
          </div>
        )}
      </div>

      {!currentTask ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            Nenhuma tarefa selecionada. Crie uma nova tarefa na aba 'Inserir Tarefa'.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ALERTA INTERATIVO: Confirmação para Trocar para IA Paga quando OmniRoute falhar (Issue #8) */}
          {(currentTask.status === 'WAITING_FALLBACK_CONFIRMATION' || fallbackPrompt) && (
            <Card className="border-cyan-500/60 bg-cyan-50/20 dark:bg-cyan-950/30 shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 text-cyan-900 dark:text-cyan-200">
                    <CreditCard className="w-5 h-5 text-cyan-500" />
                    <CardTitle className="text-base">
                      OmniRoute Indisponível — Deseja trocar para a IA Paga (Gemini Direto)?
                    </CardTitle>
                  </div>
                  <Badge variant="warning">Confirmação de Custo</Badge>
                </div>
                <CardDescription className="text-slate-600 dark:text-slate-300">
                  O gateway OmniRoute (:20128) retornou falha ao processar os modelos gratuitos/configurados. A tarefa foi pausada antes de falhar para que você decida se autoriza o uso da IA Paga.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fallbackPrompt && (
                  <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div>
                      <span className="font-semibold text-slate-500">Agente Especialista:</span>{' '}
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {fallbackPrompt.specialistRole}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Modelos Tentados no OmniRoute:</span>{' '}
                      <span className="font-mono">
                        {fallbackPrompt.failedPrimaryModel} ➔ {fallbackPrompt.failedFallbackModel}
                      </span>
                    </div>
                    <div className="text-rose-600 dark:text-rose-400 font-mono">
                      {fallbackPrompt.omniErrorMessage}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Modelo da IA Paga (Google Gemini Direto):
                    </label>
                    <select
                      value={selectedPaidModel}
                      onChange={(e) => setSelectedPaidModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    >
                      <option value="gemini-2.5-pro">gemini-2.5-pro (Pago — Alta Precisão)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Pago/Rápido — Menor Custo)</option>
                    </select>
                  </div>

                  {fallbackPrompt && !fallbackPrompt.hasConfiguredPaidKey && (
                    <div>
                      <label className="block text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" />
                        Chave GEMINI_API_KEY (será salva no Cofre):
                      </label>
                      <input
                        type="password"
                        value={apiKeyOverride}
                        onChange={(e) => setApiKeyOverride(e.target.value)}
                        placeholder="Cole sua AIzaSy... do Google AI Studio"
                        className="w-full px-3 py-2 rounded-lg border border-amber-400 dark:border-amber-700 bg-white dark:bg-slate-900 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={loadingFallbackDecision}
                    onClick={() => handlePaidFallbackDecision('DECLINE')}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Não Autorizar (Cancelar Tarefa)
                  </Button>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingFallbackDecision}
                      onClick={() => handlePaidFallbackDecision('APPROVE_ONCE')}
                      className="border-cyan-500 text-cyan-700 dark:text-cyan-300"
                    >
                      ⚡ Autorizar Apenas nesta Chamada
                    </Button>

                    <Button
                      type="button"
                      variant="cyan"
                      size="sm"
                      disabled={loadingFallbackDecision}
                      onClick={() => handlePaidFallbackDecision('APPROVE_TASK')}
                    >
                      <CreditCard className="w-4 h-4 mr-1.5" /> Autorizar até o Fim desta Tarefa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PAINEL DE FALHA & RETRY RÁPIDO (Quando FAILED ou REJECTED) */}
          {(currentTask.status === 'FAILED' || currentTask.status === 'REJECTED') && (
            <Card className="border-rose-500/50 bg-rose-50/15 dark:bg-rose-950/20 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                    <CardTitle className="text-base">
                      Execução Interrompida — Card #{currentTask.cardId}: {currentTask.cardTitle}
                    </CardTitle>
                  </div>

                  {currentTask.failureIssueUrl && (
                    <a
                      href={currentTask.failureIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 hover:underline border border-rose-300 dark:border-rose-700"
                    >
                      <Bug className="w-3.5 h-3.5 mr-1.5" />
                      Issue Automática Criada #{currentTask.failureIssueNumber || 'Ver'}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  )}
                </div>
                {currentTask.errorMessage && (
                  <CardDescription className="text-rose-600 dark:text-rose-300 font-mono text-xs pt-1">
                    {currentTask.errorMessage}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
                  <span className="font-bold block text-slate-400 uppercase text-[10px] mb-1">
                    Descrição do Card Enviado:
                  </span>
                  {currentTask.cardDescription || 'Sem descrição adicional.'}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={retryingTask}
                    onClick={() => handleQuickRetry(false)}
                  >
                    <RotateCcw className={`w-4 h-4 mr-1.5 ${retryingTask ? 'animate-spin' : ''}`} />
                    Tentar Novamente (Padrão)
                  </Button>

                  <Button
                    type="button"
                    variant="cyan"
                    size="sm"
                    disabled={retryingTask}
                    onClick={() => handleQuickRetry(true)}
                  >
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    Tentar Novamente (Autorizando IA Paga)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Caixa de Decisão Human-in-the-Loop & Refinamento Iterativo */}
          {currentTask.status === 'WAITING_APPROVAL' && (
            <Card className="border-amber-500/40 bg-amber-50/15 dark:bg-amber-950/20 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-base">Decisão Humana Requerida — Diagnóstico do Tech Lead</CardTitle>
                </div>
                <CardDescription>
                  Avalie o diagnóstico abaixo. Você pode aprovar a implementação, solicitar ajustes com feedback ou rejeitar a demanda.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Deseja algum ajuste no entendimento ou regras? Escreva seu feedback aqui e clique em 'Refinar Diagnóstico'..."
                  className="w-full p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={loadingDecision}
                    onClick={() => handleDecision('REJECT')}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Rejeitar Demanda
                  </Button>

                  <div className="flex items-center space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingDecision || !feedback.trim()}
                      onClick={() => handleDecision('REFINE')}
                      className="border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" /> Refinar Diagnóstico
                    </Button>

                    <Button
                      type="button"
                      variant="cyan"
                      size="sm"
                      disabled={loadingDecision}
                      onClick={() => handleDecision('APPROVE')}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Aprovar e Iniciar Implementação
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Relatório de Entrega quando COMPLETED */}
          {currentTask.status === 'COMPLETED' && currentTask.deliveryReport && (
            <DeliveryReportViewer
              cardId={currentTask.cardId}
              reportMarkdown={currentTask.deliveryReport}
              pullRequestUrl={currentTask.pullRequestUrl}
            />
          )}

          {/* Diagnóstico Antigravity Estruturado */}
          {currentTask.diagnosticPlan && (
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-cyan-500" />
                    <CardTitle className="text-base">Diagnóstico Arquitetural Antigravity (Texto & Regras)</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    {currentTask.assignedAgents?.map((agent: string) => (
                      <Badge key={agent} variant="cyan">
                        {agent}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="prose dark:prose-invert max-w-none text-sm space-y-4">
                  <ReactMarkdown>{currentTask.diagnosticPlan}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terminal de Logs em Tempo Real */}
          <TerminalLog taskId={currentTask.id} />
        </div>
      )}
    </div>
  );
};
