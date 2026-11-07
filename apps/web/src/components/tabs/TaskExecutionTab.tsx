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
  Bot,
  Layers,
  Sparkles,
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
        setCurrentTask((prev: any) => ({ ...prev, status: payload.status }));
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
    } catch {
      // Falha silenciosa
    }
  };

  // Envia decisão humana via WebSocket
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">✅ Concluído</Badge>;
      case 'WAITING_APPROVAL':
        return <Badge variant="warning">⏳ Aguardando Decisão</Badge>;
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
