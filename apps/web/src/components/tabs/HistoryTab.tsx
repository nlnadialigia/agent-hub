import React, { useState, useEffect } from 'react';
import {
  History,
  Archive,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  FileText,
  X,
  Eye,
  AlertTriangle,
  Bug,
  CreditCard,
  Play,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { DeliveryReportViewer } from '../DeliveryReportViewer';

interface HistoryTabProps {
  onNavigateToExecution?: (taskId: string) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ onNavigateToExecution }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedReportTask, setSelectedReportTask] = useState<any | null>(null);

  // Modal de Detalhes do Card & Nova Tentativa (Issue #8)
  const [inspectTask, setInspectTask] = useState<any | null>(null);
  const [retryInstructions, setRetryInstructions] = useState<string>('');
  const [retryAllowPaid, setRetryAllowPaid] = useState<boolean>(false);
  const [retryResumeCheckpoint, setRetryResumeCheckpoint] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);

  useEffect(() => {
    loadHistory();
  }, [showArchived]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await AgentHubApi.getTasks(showArchived);
      setTasks(data);
    } catch {
      // Falha silenciosa
    } finally {
      setLoading(false);
    }
  };

  const openInspectModal = (task: any) => {
    setInspectTask(task);
    setRetryInstructions(task.customInstructions || '');
    setRetryAllowPaid(Boolean(task.allowPaidFallback));
    setRetryResumeCheckpoint(Boolean(task.diagnosticPlan));
  };

  const handleRetryTask = async () => {
    if (!inspectTask) return;
    setRetrying(true);
    try {
      const updated = await AgentHubApi.retryTask(inspectTask.id, {
        customInstructions: retryInstructions,
        allowPaidFallback: retryAllowPaid,
        resumeFromCheckpoint: retryResumeCheckpoint,
      });
      setInspectTask(null);
      await loadHistory();
      if (onNavigateToExecution) {
        onNavigateToExecution(updated.id);
      }
    } catch (err: any) {
      alert(`Erro ao tentar novamente: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (confirm('Tem certeza que deseja arquivar esta tarefa do histórico?')) {
      try {
        await AgentHubApi.archiveTask(id);
        await loadHistory();
      } catch (err: any) {
        alert(`Erro ao arquivar: ${err.message}`);
      }
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await AgentHubApi.restoreTask(id);
      await loadHistory();
    } catch (err: any) {
      alert(`Erro ao restaurar: ${err.message}`);
    }
  };

  // Formata data no padrão DD/MM/AAAA sem horário (Requisito da Issue #5)
  const formatDateDDMMAAAA = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Concluído</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'WAITING_APPROVAL':
        return <Badge variant="warning">Aguardando Decisão</Badge>;
      case 'WAITING_FALLBACK_CONFIRMATION':
        return <Badge variant="warning">Confirmação IA Paga</Badge>;
      case 'IMPLEMENTING':
        return <Badge variant="cyan">Implementando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Histórico de Demandas & Relatórios de Entrega
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Registro completo de execuções, visualização de cards enviados, reexecução em 1 clique e issues automáticas de falha.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-0"
            />
            <span>Mostrar Arquivados</span>
          </label>

          <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Modal / Visualizador de Relatório de Entrega */}
      {selectedReportTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8 relative">
            <button
              onClick={() => setSelectedReportTask(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 shadow-lg z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <DeliveryReportViewer
              cardId={selectedReportTask.cardId}
              reportMarkdown={selectedReportTask.deliveryReport}
              pullRequestUrl={selectedReportTask.pullRequestUrl}
            />
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Card Enviado & Tentar Novamente (Issue #8) */}
      {inspectTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full my-8 shadow-2xl overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center space-x-3">
                <Badge variant="cyan">{inspectTask.taskProvider}</Badge>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Card #{inspectTask.cardId} — {inspectTask.cardTitle}
                </h3>
                {inspectTask.retryCount > 0 && (
                  <Badge variant="outline">Tentativa #{inspectTask.retryCount + 1}</Badge>
                )}
              </div>
              <button
                onClick={() => setInspectTask(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Metadados Rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block">Repositório</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {inspectTask.repository?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Branch Alvo</span>
                  <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                    {inspectTask.targetBranch || 'main'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Destino VCS</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {inspectTask.vcsProvider}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status Atual</span>
                  <div className="mt-0.5">{getStatusBadge(inspectTask.status)}</div>
                </div>
              </div>

              {/* Diagnóstico de Erro e Issue Criada Automaticamente (quando houver falha) */}
              {(inspectTask.errorMessage || inspectTask.failureIssueUrl) && (
                <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900/80 bg-rose-50/70 dark:bg-rose-950/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 font-semibold text-xs uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <span>
                        Motivo da Falha {inspectTask.failedStage ? `(Etapa: ${inspectTask.failedStage})` : ''}
                      </span>
                    </div>

                    {inspectTask.failureIssueUrl && (
                      <a
                        href={inspectTask.failureIssueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 hover:underline border border-rose-300 dark:border-rose-700"
                      >
                        <Bug className="w-3.5 h-3.5 mr-1" />
                        Issue Automática #{inspectTask.failureIssueNumber || 'Ver'}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>

                  {inspectTask.errorMessage && (
                    <pre className="text-xs font-mono text-rose-800 dark:text-rose-200 bg-white/80 dark:bg-slate-950/80 p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 whitespace-pre-wrap break-words">
                      {inspectTask.errorMessage}
                    </pre>
                  )}
                </div>
              )}

              {/* Descrição Original do Card Enviado */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  📋 Descrição Original do Card Enviado
                </label>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {inspectTask.cardDescription || 'Sem descrição detalhada no card original.'}
                </div>
              </div>

              {/* Instruções Adicionais Editáveis para Nova Tentativa */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ✍️ Instruções Adicionais / Complementares (Markdown — Editável para Reenvio)
                </label>
                <textarea
                  rows={4}
                  value={retryInstructions}
                  onChange={(e) => setRetryInstructions(e.target.value)}
                  placeholder="Adicione ou ajuste instruções extras para orientar a Squad nesta nova tentativa..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              {/* Opções de Recuperação e Fallback */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/40 dark:bg-cyan-950/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={retryAllowPaid}
                    onChange={(e) => setRetryAllowPaid(e.target.checked)}
                    className="mt-0.5 rounded border-cyan-400 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-cyan-500" />
                      Pré-autorizar troca para IA Paga (Gemini Direto) se o OmniRoute falhar
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 block mt-0.5">
                      Se desmarcado, o sistema perguntará na tela antes de acionar a IA Paga caso o OmniRoute esteja fora.
                    </span>
                  </div>
                </label>

                {inspectTask.diagnosticPlan && (
                  <label className="flex items-start space-x-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retryResumeCheckpoint}
                      onChange={(e) => setRetryResumeCheckpoint(e.target.checked)}
                      className="mt-0.5 rounded border-slate-400 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Retomar a partir do Diagnóstico já gerado (Pular etapa de análise)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 block mt-0.5">
                        Aproveita o diagnóstico salvo anteriormente nesta tarefa e vai direto para a implementação da Squad.
                      </span>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
              <Button variant="ghost" size="sm" onClick={() => setInspectTask(null)}>
                Fechar
              </Button>

              <div className="flex items-center space-x-2">
                {onNavigateToExecution && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const id = inspectTask.id;
                      setInspectTask(null);
                      onNavigateToExecution(id);
                    }}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    Abrir na Aba Execução
                  </Button>
                )}

                <Button variant="cyan" size="sm" onClick={handleRetryTask} disabled={retrying}>
                  <RotateCcw className={`w-4 h-4 mr-1.5 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Reenviando...' : 'Tentar Novamente Agora'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela do Histórico */}
      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Nenhuma tarefa registrada no histórico.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Demanda</th>
                    <th className="px-6 py-4">Origem</th>
                    <th className="px-6 py-4">Destino / PR / Issue</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tasks.map((task) => {
                    const isFailedOrRejected = task.status === 'FAILED' || task.status === 'REJECTED';
                    return (
                      <tr
                        key={task.id}
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition ${
                          task.isArchived ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Data Formatada DD/MM/AAAA */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">
                          {formatDateDDMMAAAA(task.createdAt)}
                        </td>

                        {/* Título & Card */}
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              #{task.cardId} — {task.cardTitle}
                            </span>
                            {task.retryCount > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                Retry #{task.retryCount}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{task.repository?.name || 'Repositório'}</div>
                          {task.errorMessage && (
                            <div className="text-[11px] text-rose-500 dark:text-rose-400 truncate max-w-md mt-0.5">
                              ⚠️ {task.errorMessage}
                            </div>
                          )}
                        </td>

                        {/* Origem (Board) */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="cyan">{task.taskProvider}</Badge>
                        </td>

                        {/* Destino (PR ou Issue de Falha) */}
                        <td className="px-6 py-4 whitespace-nowrap space-y-1">
                          {task.pullRequestUrl ? (
                            <a
                              href={task.pullRequestUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              <span>PR ({task.vcsProvider})</span>
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 block">{task.vcsProvider}</span>
                          )}

                          {task.failureIssueUrl && (
                            <a
                              href={task.failureIssueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium"
                              title="Issue criada automaticamente para esta falha"
                            >
                              <Bug className="w-3 h-3 mr-1" />
                              <span>Issue #{task.failureIssueNumber || 'Erro'}</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-1" />
                            </a>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(task.status)}</td>

                        {/* Ações */}
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <Button
                            size="sm"
                            variant={isFailedOrRejected ? 'cyan' : 'outline'}
                            onClick={() => openInspectModal(task)}
                            className="text-xs"
                            title="Visualizar detalhes do card enviado e tentar novamente"
                          >
                            {isFailedOrRejected ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                Ver Card & Tentar Novamente
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 mr-1 text-cyan-500" />
                                Ver Card
                              </>
                            )}
                          </Button>

                          {task.deliveryReport && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedReportTask(task)}
                              className="text-xs"
                            >
                              <FileText className="w-3.5 h-3.5 mr-1 text-cyan-500" />
                              Relatório
                            </Button>
                          )}

                          {task.isArchived ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRestore(task.id)}
                              className="text-xs text-slate-500 hover:text-emerald-500"
                              title="Restaurar Tarefa"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(task.id)}
                              className="text-xs text-slate-400 hover:text-rose-500"
                              title="Arquivar Tarefa (Soft-Delete)"
                            >
                              <Archive className="w-3.5 h-3.5 mr-1" /> Arquivar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
