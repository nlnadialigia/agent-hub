import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Play,
  RotateCcw,
  Eye,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

interface TaskInsertTabProps {
  onTaskCreated: (taskId: string) => void;
  onNavigateToExecution: (taskId: string) => void;
}

export const TaskInsertTab: React.FC<TaskInsertTabProps> = ({ onTaskCreated, onNavigateToExecution }) => {
  const [boardType, setBoardType] = useState<string>('KANBANIZE');
  const [cardId, setCardId] = useState<string>('');
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [vcsProvider, setVcsProvider] = useState<string>('GITHUB');
  const [targetBranch, setTargetBranch] = useState<string>('main');
  const [executionMode, setExecutionMode] = useState<'SEQUENTIAL' | 'CONCURRENT'>('SEQUENTIAL');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cardPreview, setCardPreview] = useState<any | null>(null);
  const [activeQueue, setActiveQueue] = useState<any[]>([]);

  // Carrega repositórios e fila ativa
  useEffect(() => {
    loadRepositories();
    loadActiveQueue();
    const interval = setInterval(loadActiveQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRepositories = async () => {
    try {
      const data = await AgentHubApi.getRepositories();
      setRepositories(data);
      if (data.length > 0 && !selectedRepoId) {
        setSelectedRepoId(data[0].id);
        setVcsProvider(data[0].detectedVcs || 'GITHUB');
        setTargetBranch(data[0].targetBranch || 'main');
      }
    } catch {
      // Repositórios ainda não escaneados
    }
  };

  const loadActiveQueue = async () => {
    try {
      const tasks = await AgentHubApi.getTasks(false);
      // Filtra tarefas ativas que estão em andamento ou em fila
      const active = tasks.filter((t: any) =>
        ['QUEUED', 'PENDING_DIAGNOSTIC', 'WAITING_APPROVAL', 'IMPLEMENTING', 'RUNNING_TESTS', 'SELF_HEALING'].includes(
          t.status
        )
      );
      setActiveQueue(active);
    } catch {
      // Falha silenciosa
    }
  };

  // Quando o usuário muda o repositório, ajusta VCS e branch padrão
  const handleRepoChange = (repoId: string) => {
    setSelectedRepoId(repoId);
    const repo = repositories.find((r) => r.id === repoId);
    if (repo) {
      setVcsProvider(repo.detectedVcs || 'GITHUB');
      setTargetBranch(repo.targetBranch || (repo.detectedVcs === 'AZURE_DEVOPS' ? 'develop' : 'main'));
    }
  };

  // Pré-visualizar Card no Board
  const handlePreviewCard = async () => {
    if (!cardId.trim()) return;
    setPreviewLoading(true);
    setCardPreview(null);
    try {
      const data = await AgentHubApi.fetchCardPreview(boardType, cardId.trim());
      setCardPreview(data);
    } catch (err: any) {
      alert(`Não foi possível pré-visualizar o card: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Iniciar Tarefa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId.trim()) return;

    setLoading(true);
    try {
      const created = await AgentHubApi.createTask({
        cardId: cardId.trim(),
        repositoryId: selectedRepoId,
        taskProvider: boardType,
        vcsProvider,
        targetBranch,
        executionMode,
        customInstructions: customInstructions.trim() || undefined,
      });

      // Limpa os campos
      setCardId('');
      setCustomInstructions('');
      setCardPreview(null);
      await loadActiveQueue();

      onTaskCreated(created.id);
      onNavigateToExecution(created.id);
    } catch (err: any) {
      alert(`Erro ao criar tarefa: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const boardOptions = [
    { id: 'KANBANIZE', label: 'Kanbanize / Businessmap' },
    { id: 'GITHUB_ISSUES', label: 'GitHub Issues' },
    { id: 'JIRA', label: 'Jira Software' },
    { id: 'TRELLO', label: 'Trello' },
    { id: 'LINEAR', label: 'Linear' },
    { id: 'MANUAL', label: 'Demanda Manual' },
  ];

  const vcsOptions = [
    { id: 'GITHUB', label: 'GitHub' },
    { id: 'AZURE_DEVOPS', label: 'Azure DevOps' },
    { id: 'GITLAB', label: 'GitLab' },
    { id: 'BITBUCKET', label: 'Bitbucket' },
    { id: 'LOCAL_ONLY', label: 'Apenas Local' },
  ];

  return (
    <div className="space-y-8">
      {/* Formulário Principal */}
      <Card className="border-cyan-500/20 shadow-lg shadow-cyan-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle>Inserir Demanda na Squad de Engenharia</CardTitle>
                <CardDescription>
                  Configure a origem da demanda, o repositório de destino e as instruções de implementação.
                </CardDescription>
              </div>
            </div>
            <Badge variant="cyan">Multi-Platform & Multi-Stack</Badge>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Origem da Demanda (Board) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Origem da Demanda (Board)
                </label>
                <select
                  value={boardType}
                  onChange={(e) => setBoardType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {boardOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Card ID / Issue # */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Card ID / Issue # / Prompt
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    placeholder={boardType === 'MANUAL' ? 'Ex: Implementar autenticação JWT' : 'Ex: 1045 ou #42'}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  {boardType !== 'MANUAL' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePreviewCard}
                      disabled={previewLoading || !cardId.trim()}
                      className="whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 mr-1.5 text-cyan-600 dark:text-cyan-400" />
                      {previewLoading ? 'Lendo...' : 'Pré-visualizar'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Repositório Alvo */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Repositório Alvo (Poliglota)
                </label>
                <select
                  value={selectedRepoId}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {repositories.length === 0 ? (
                    <option value="">Nenhum repositório escaneado</option>
                  ) : (
                    repositories.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name} ({repo.primaryLanguage})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Destino do PR & Target Branch */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Destino do PR (Git)
                  </label>
                  <select
                    value={vcsProvider}
                    onChange={(e) => setVcsProvider(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    {vcsOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Branch Alvo (Target)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      placeholder="main ou develop"
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                    <GitBranch className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview do Card se carregado */}
            {cardPreview && (
              <div className="p-4 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-900 dark:text-cyan-200">{cardPreview.title}</span>
                  <Badge variant="cyan">{boardType}</Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-wrap">
                  {cardPreview.description || 'Sem descrição cadastrada no card.'}
                </p>
              </div>
            )}

            {/* Modo de Execução */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Modo de Execução
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setExecutionMode('SEQUENTIAL')}
                  className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
                    executionMode === 'SEQUENTIAL'
                      ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Clock className="w-5 h-5 text-cyan-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">🔄 Em Sequência (Fila)</div>
                    <div className="text-xs opacity-75">Executa ordenadamente respeitando a fila de tarefas.</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionMode('CONCURRENT')}
                  className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
                    executionMode === 'CONCURRENT'
                      ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers className="w-5 h-5 text-cyan-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">⚡ Concomitante (Git Worktree)</div>
                    <div className="text-xs opacity-75">Sandbox isolada permitindo tarefas paralelas sem colisão.</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Instruções Adicionais em Markdown (Issue #4 ampliado) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Instruções Adicionais & Diretrizes Técnicas (Markdown)
                </label>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400">{customInstructions.length} caracteres</span>
                  {customInstructions && (
                    <button
                      type="button"
                      onClick={() => setCustomInstructions('')}
                      className="text-xs text-rose-500 hover:underline flex items-center"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Limpar
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={5}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Exemplo em Markdown:&#10;### Diretrizes de Implementação:&#10;- Criar endpoints REST documentados com schemas Zod&#10;- Garantir cobertura de testes unitários para casos de erro&#10;- Não alterar migrations existentes"
                className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none min-h-[120px]"
              />
            </div>

            {/* Botão de Envio */}
            <div className="flex justify-end pt-2">
              <Button type="submit" variant="cyan" size="lg" disabled={loading || !cardId.trim()}>
                {loading ? (
                  <>Iniciando Squad...</>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" /> Iniciar Tarefa com a Squad
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Painel Inferior: Fila Viva & Em Andamento */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              <CardTitle className="text-base">Fila Viva & Tarefas em Execução ({activeQueue.length})</CardTitle>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Concluídas ou rejeitadas vão direto para o Histórico
            </span>
          </div>
        </CardHeader>

        <CardContent>
          {activeQueue.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              Nenhuma tarefa em andamento no momento. Insira uma demanda acima para ativar a Squad!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeQueue.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        #{item.cardId} — {item.cardTitle}
                      </span>
                      <Badge variant="cyan">{item.taskProvider}</Badge>
                      <Badge variant="outline">{item.repository?.name || 'Repo'}</Badge>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <span>Status: <strong className="text-cyan-600 dark:text-cyan-400">{item.status}</strong></span>
                      <span>Branch: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{item.targetBranch}</code></span>
                      <span>Modo: {item.executionMode}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateToExecution(item.id)}
                    className="group"
                  >
                    <span>Acompanhar</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-1 text-cyan-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
