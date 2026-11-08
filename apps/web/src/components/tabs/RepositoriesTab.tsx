import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  RefreshCw,
  Plus,
  Check,
  FolderOpen,
  FolderSearch,
  FolderSync,
  Trash2,
  Filter,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

export const RepositoriesTab: React.FC = () => {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [monitoredDirectories, setMonitoredDirectories] = useState<any[]>([]);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rescanningDirId, setRescanningDirId] = useState<string | null>(null);
  const [showScanForm, setShowScanForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanName, setScanName] = useState('');
  const [batchPath, setBatchPath] = useState('/home/nlnadialigia');
  const [savedTargetBranchId, setSavedTargetBranchId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repos, dirs] = await Promise.all([
        AgentHubApi.getRepositories(),
        AgentHubApi.getMonitoredDirectories(),
      ]);
      setRepositories(repos);
      setMonitoredDirectories(dirs);
    } catch {
      // Falha silenciosa
    } finally {
      setLoading(false);
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanPath.trim()) return;

    setLoading(true);
    try {
      await AgentHubApi.scanRepository(scanPath.trim(), scanName.trim() || undefined, true);
      setScanPath('');
      setScanName('');
      setShowScanForm(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao escanear repositório: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchPath.trim()) return;

    setLoading(true);
    try {
      const res = await AgentHubApi.scanDirectory(batchPath.trim());
      alert(`Varredura concluída! ${res.scannedCount} repositório(s) descobertos e importados da pasta.`);
      setShowBatchForm(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao escanear pasta de repositórios: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRescanDirectory = async (dirId: string) => {
    setRescanningDirId(dirId);
    try {
      const res = await AgentHubApi.rescanMonitoredDirectory(dirId);
      alert(`Re-escaneamento concluído! ${res.scannedCount} repositório(s) atualizados.`);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao re-escanear pasta: ${err.message}`);
    } finally {
      setRescanningDirId(null);
    }
  };

  const handleDeleteDirectory = async (dirId: string, dirName: string) => {
    if (!confirm(`Deseja remover a pasta monitorada '${dirName}'? Os repositórios já escaneados serão preservados no catálogo.`)) return;
    try {
      await AgentHubApi.deleteMonitoredDirectory(dirId);
      if (selectedDirectoryId === dirId) setSelectedDirectoryId(null);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao remover pasta: ${err.message}`);
    }
  };

  const handleTargetBranchChange = async (repoId: string, targetBranch: string) => {
    try {
      await AgentHubApi.updateTargetBranch(repoId, targetBranch);
      setSavedTargetBranchId(repoId);
      setTimeout(() => setSavedTargetBranchId(null), 2000);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao atualizar branch: ${err.message}`);
    }
  };

  const filteredRepositories = selectedDirectoryId
    ? repositories.filter((r) => r.monitoredDirectoryId === selectedDirectoryId)
    : repositories;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Repositórios & Perfis Poliglotas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pastas monitoradas, mapeamento de stacks (Node, Python, React, Prisma) e branch alvo para PRs.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowBatchForm(!showBatchForm);
              setShowScanForm(false);
            }}
            className="border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
          >
            <FolderOpen className="w-4 h-4 mr-1.5 text-cyan-500" />
            Escanear Pasta (Lote)
          </Button>

          <Button
            variant="cyan"
            size="sm"
            onClick={() => {
              setShowScanForm(!showScanForm);
              setShowBatchForm(false);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Escanear Repositório
          </Button>
        </div>
      </div>

      {/* Seção de Pastas-Raiz Monitoradas */}
      {monitoredDirectories.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                  <FolderSync className="w-4 h-4 text-cyan-500" />
                  <span>Pastas Monitoradas no Banco</span>
                  <Badge variant="cyan" className="ml-2 text-[11px]">
                    {monitoredDirectories.length} {monitoredDirectories.length === 1 ? 'pasta cadastrada' : 'pastas cadastradas'}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Pastas-raiz salvas. Clique em Re-escanear para atualizar os repositórios em 1 clique ou clique na pasta para filtrar a listagem abaixo.
                </CardDescription>
              </div>

              {selectedDirectoryId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDirectoryId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  Limpar Filtro ({repositories.length} totais)
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {monitoredDirectories.map((dir) => {
                const isSelected = selectedDirectoryId === dir.id;
                const isRescanning = rescanningDirId === dir.id;
                return (
                  <div
                    key={dir.id}
                    onClick={() => setSelectedDirectoryId(isSelected ? null : dir.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-400/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                          <FolderOpen className="w-4 h-4 text-cyan-500" />
                          <span>{dir.name}</span>
                        </span>
                        <Badge variant={isSelected ? 'cyan' : 'secondary'} className="text-[10px]">
                          {dir.scannedReposCount || dir.repositories?.length || 0} repos
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={dir.path}>
                        {dir.path}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Última varredura: {new Date(dir.lastScannedAt).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(dir.lastScannedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center justify-end space-x-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                        disabled={isRescanning || loading}
                        onClick={() => handleRescanDirectory(dir.id)}
                        title="Re-escanear esta pasta agora"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRescanning ? 'animate-spin' : ''}`} />
                        {isRescanning ? 'Varrendo...' : 'Re-escanear'}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => handleDeleteDirectory(dir.id, dir.name)}
                        title="Remover pasta monitorada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de Escaneamento em Lote */}
      {showBatchForm && (
        <Card className="border-cyan-500/40 bg-cyan-50/10 dark:bg-cyan-950/20 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-cyan-700 dark:text-cyan-300 flex items-center space-x-2">
              <FolderSearch className="w-5 h-5 text-cyan-500" />
              <span>Escanear Pasta Completa & Importar Múltiplos Repositórios</span>
            </CardTitle>
            <CardDescription>
              Informe um diretório pai (ex: <code>/home/nlnadialigia/suzano</code> ou <code>/home/nlnadialigia/www</code>). A pasta será salva no banco como pasta monitorada para re-varreduras rápidas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBatchScanSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500">Caminho da Pasta Pai no Host</label>
                <input
                  type="text"
                  required
                  value={batchPath}
                  onChange={(e) => setBatchPath(e.target.value)}
                  placeholder="Ex: /home/nlnadialigia/suzano ou /home/nlnadialigia/www"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowBatchForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="cyan" size="sm" disabled={loading || !batchPath.trim()}>
                  {loading ? 'Varrendo Subpastas...' : 'Iniciar Varredura & Salvar Pasta'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Formulário de Escaneamento Individual */}
      {showScanForm && (
        <Card className="border-cyan-500/40 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-cyan-700 dark:text-cyan-300">
              Escanear Novo Repositório Local
            </CardTitle>
            <CardDescription>
              Informe o caminho local do repositório para o scanner poliglota mapear dependências e git remotes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScanSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Caminho Local (Absoluto ou Relativo)</label>
                  <input
                    type="text"
                    required
                    value={scanPath}
                    onChange={(e) => setScanPath(e.target.value)}
                    placeholder="Ex: /home/nlnadialigia/suzano/portal-florestal-backend"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Nome Amigável (Opcional)</label>
                  <input
                    type="text"
                    value={scanName}
                    onChange={(e) => setScanName(e.target.value)}
                    placeholder="Ex: API de Pagamentos"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowScanForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="cyan" size="sm" disabled={loading || !scanPath.trim()}>
                  {loading ? 'Analisando...' : 'Iniciar Análise Poliglota'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Grid de Repositórios */}
      {filteredRepositories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400 text-sm">
            {selectedDirectoryId
              ? 'Nenhum repositório encontrado para esta pasta monitorada selecionada.'
              : 'Nenhum repositório escaneado ainda. Clique em "Escanear Pasta (Lote)" ou "Escanear Repositório".'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRepositories.map((repo) => (
            <Card key={repo.id} className="border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <span>{repo.name}</span>
                      <Badge variant="cyan">{repo.primaryLanguage}</Badge>
                      {repo.monitoredDirectory?.name && (
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          📁 {repo.monitoredDirectory.name}
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-slate-400 font-mono break-all">{repo.localPath}</p>
                  </div>
                  <Badge variant="outline">{repo.detectedVcs}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                {/* Stacks Detectadas */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Tecnologias & Stacks
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {repo.stacks?.map((st: string) => (
                      <Badge key={st} variant="secondary" className="text-[11px]">
                        {st}
                      </Badge>
                    ))}
                    {repo.orm && <Badge variant="warning">{repo.orm}</Badge>}
                  </div>
                </div>

                {/* Target Branch Config */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      Branch Alvo de Pull Requests:
                    </span>
                    {savedTargetBranchId === repo.id && (
                      <span className="text-emerald-500 flex items-center text-[11px]">
                        <Check className="w-3 h-3 mr-0.5" /> Salva!
                      </span>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <input
                      type="text"
                      defaultValue={repo.targetBranch}
                      id={`branch-input-${repo.id}`}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const val = (document.getElementById(`branch-input-${repo.id}`) as HTMLInputElement)?.value;
                        if (val) handleTargetBranchChange(repo.id, val.trim());
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
