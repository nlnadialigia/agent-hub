import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  GitBranch,
  RefreshCw,
  Plus,
  Check,
  Code2,
  Server,
  Layers,
  FileCheck,
  FolderOpen,
  FolderSearch,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

export const RepositoriesTab: React.FC = () => {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanForm, setShowScanForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanName, setScanName] = useState('');
  const [batchPath, setBatchPath] = useState('/home/nlnadialigia');
  const [savedTargetBranchId, setSavedTargetBranchId] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const data = await AgentHubApi.getRepositories();
      setRepositories(data);
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
      await loadRepositories();
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
      await loadRepositories();
    } catch (err: any) {
      alert(`Erro ao escanear pasta de repositórios: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTargetBranchChange = async (repoId: string, targetBranch: string) => {
    try {
      await AgentHubApi.updateTargetBranch(repoId, targetBranch);
      setSavedTargetBranchId(repoId);
      setTimeout(() => setSavedTargetBranchId(null), 2000);
      await loadRepositories();
    } catch (err: any) {
      alert(`Erro ao atualizar branch: ${err.message}`);
    }
  };

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
              Mapeamento de stacks (Node, Python, React, Prisma) e branch alvo para PRs.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={loadRepositories} disabled={loading}>
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

      {/* Formulário de Escaneamento em Lote */}
      {showBatchForm && (
        <Card className="border-cyan-500/40 bg-cyan-50/10 dark:bg-cyan-950/20 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-cyan-700 dark:text-cyan-300 flex items-center space-x-2">
              <FolderSearch className="w-5 h-5 text-cyan-500" />
              <span>Escanear Pasta Completa & Importar Múltiplos Repositórios</span>
            </CardTitle>
            <CardDescription>
              Informe um diretório pai (ex: <code>/home/nlnadialigia</code> ou <code>/home/nlnadialigia/projetos</code>). O sistema varrerá as subpastas e importará todos os projetos com Git automaticamente.
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
                  placeholder="Ex: /home/nlnadialigia"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowBatchForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="cyan" size="sm" disabled={loading || !batchPath.trim()}>
                  {loading ? 'Varrendo Subpastas...' : 'Iniciar Varredura em Lote'}
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
                    placeholder="Ex: /home/usuario/meu-projeto ou ../meu-projeto"
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
      {repositories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400 text-sm">
            Nenhum repositório escaneado ainda. Clique em "Escanear Repositório" para mapear seu projeto.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {repositories.map((repo) => (
            <Card key={repo.id} className="border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <span>{repo.name}</span>
                      <Badge variant="cyan">{repo.primaryLanguage}</Badge>
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
