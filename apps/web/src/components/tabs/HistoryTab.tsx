import React, { useState, useEffect } from 'react';
import {
  History,
  Archive,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  FileText,
  X,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { DeliveryReportViewer } from '../DeliveryReportViewer';

export const HistoryTab: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedReportTask, setSelectedReportTask] = useState<any | null>(null);

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
              Registro completo de execuções com formatação DD/MM/AAAA e arquivamento seguro (Soft-Delete).
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

      {/* Modal / Visualizador de Relatório */}
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
                    <th className="px-6 py-4">Destino / PR</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tasks.map((task) => (
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
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          #{task.cardId} — {task.cardTitle}
                        </div>
                        <div className="text-xs text-slate-400">{task.repository?.name || 'Repositório'}</div>
                      </td>

                      {/* Origem (Board) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="cyan">{task.taskProvider}</Badge>
                      </td>

                      {/* Destino (PR) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.pullRequestUrl ? (
                          <a
                            href={task.pullRequestUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            <span>{task.vcsProvider}</span>
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">{task.vcsProvider}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(task.status)}</td>

                      {/* Ações */}
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
