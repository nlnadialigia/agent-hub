import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

export const SettingsIntegrationsTab: React.FC = () => {
  const [connections, setConnections] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await AgentHubApi.getConnections();
      setConnections(data);
    } catch {
      // Falha silenciosa
    }
  };

  const handleTest = async (category: 'TASK_PROVIDER' | 'VCS_PROVIDER', providerType: string, config?: any) => {
    setTestingProvider(providerType);
    try {
      const res = await AgentHubApi.testConnection({ category, providerType, config });
      setTestResults((prev) => ({ ...prev, [providerType]: res }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerType]: { ok: false, message: err.response?.data?.message || err.message },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = async (
    category: 'TASK_PROVIDER' | 'VCS_PROVIDER' | 'LLM_PROVIDER',
    providerType: string,
    name: string,
    config: Record<string, any>
  ) => {
    setSavingProvider(providerType);
    try {
      await AgentHubApi.saveConnection({
        category,
        providerType,
        name,
        config,
      });
      alert(`Conexão '${name}' salva com sucesso no cofre seguro!`);
      await loadConnections();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Cofre de Credenciais & Conexões
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Criptografia AES-256 no PostgreSQL com fallback automático para variáveis do <code>.env</code>.
            </p>
          </div>
        </div>

        <Badge variant="cyan">Segurança AES-256-GCM</Badge>
      </div>

      {/* BLOCO 1: Conexões de Boards (Task Providers) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
          <span>📋 Conexões de Boards & Demandas</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kanbanize */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-cyan-600 dark:text-cyan-400">
                  Kanbanize / Businessmap
                </CardTitle>
                <Badge variant="cyan">REST API v2 + Subtasks</Badge>
              </div>
              <CardDescription className="text-xs">
                Sincroniza Cards e cria/atualiza Subtasks em tempo real à medida que a Squad avança.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Subdomínio (ex: empresa)</label>
                <input
                  type="text"
                  id="kanbanize-subdomain"
                  placeholder="Seu subdomínio Kanbanize"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">API Key v2</label>
                <input
                  type="password"
                  id="kanbanize-key"
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              {testResults['KANBANIZE'] && (
                <div
                  className={`p-2 rounded text-xs flex items-center ${
                    testResults['KANBANIZE'].ok
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {testResults['KANBANIZE'].ok ? (
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1 text-rose-500 flex-shrink-0" />
                  )}
                  <span>{testResults['KANBANIZE'].message}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testingProvider === 'KANBANIZE'}
                  onClick={() => {
                    const sub = (document.getElementById('kanbanize-subdomain') as HTMLInputElement)?.value;
                    const key = (document.getElementById('kanbanize-key') as HTMLInputElement)?.value;
                    handleTest('TASK_PROVIDER', 'KANBANIZE', sub && key ? { subdomain: sub, apiKey: key } : undefined);
                  }}
                  className="text-xs"
                >
                  Testar Conexão
                </Button>
                <Button
                  size="sm"
                  variant="cyan"
                  disabled={savingProvider === 'KANBANIZE'}
                  onClick={() => {
                    const sub = (document.getElementById('kanbanize-subdomain') as HTMLInputElement)?.value;
                    const key = (document.getElementById('kanbanize-key') as HTMLInputElement)?.value;
                    handleSave('TASK_PROVIDER', 'KANBANIZE', 'Kanbanize Principal', { subdomain: sub, apiKey: key });
                  }}
                  className="text-xs"
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GitHub Issues */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-cyan-600 dark:text-cyan-400">
                  GitHub Issues
                </CardTitle>
                <Badge variant="cyan">REST API / gh CLI</Badge>
              </div>
              <CardDescription className="text-xs">
                Lê issues e labels diretamente da sua conta ou organização no GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Personal Access Token (PAT)</label>
                <input
                  type="password"
                  id="github-token"
                  placeholder="ghp_••••••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              {testResults['GITHUB_ISSUES'] && (
                <div
                  className={`p-2 rounded text-xs flex items-center ${
                    testResults['GITHUB_ISSUES'].ok
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {testResults['GITHUB_ISSUES'].ok ? (
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1 text-rose-500 flex-shrink-0" />
                  )}
                  <span>{testResults['GITHUB_ISSUES'].message}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testingProvider === 'GITHUB_ISSUES'}
                  onClick={() => {
                    const token = (document.getElementById('github-token') as HTMLInputElement)?.value;
                    handleTest('TASK_PROVIDER', 'GITHUB_ISSUES', token ? { token } : undefined);
                  }}
                  className="text-xs"
                >
                  Testar Conexão
                </Button>
                <Button
                  size="sm"
                  variant="cyan"
                  disabled={savingProvider === 'GITHUB_ISSUES'}
                  onClick={() => {
                    const token = (document.getElementById('github-token') as HTMLInputElement)?.value;
                    handleSave('TASK_PROVIDER', 'GITHUB_ISSUES', 'GitHub Token', { token });
                  }}
                  className="text-xs"
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* BLOCO 2: Conexões de Git / PRs (VCS Providers) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
          <span>🦊 Conexões de Git & Pull Requests</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Azure DevOps */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-cyan-600 dark:text-cyan-400">
                  Azure DevOps
                </CardTitle>
                <Badge variant="cyan">Branch Alvo: develop</Badge>
              </div>
              <CardDescription className="text-xs">
                Abertura de PRs apontando por padrão para <code>develop</code> ou a branch configurada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Org URL (ex: https://dev.azure.com/sua-org)</label>
                <input
                  type="text"
                  id="azure-org"
                  placeholder="https://dev.azure.com/..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Projeto</label>
                <input
                  type="text"
                  id="azure-proj"
                  placeholder="Nome do Projeto"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Personal Access Token (PAT com escopo Code)</label>
                <input
                  type="password"
                  id="azure-token"
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              {testResults['AZURE_DEVOPS'] && (
                <div
                  className={`p-2 rounded text-xs flex items-center ${
                    testResults['AZURE_DEVOPS'].ok
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {testResults['AZURE_DEVOPS'].ok ? (
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1 text-rose-500 flex-shrink-0" />
                  )}
                  <span>{testResults['AZURE_DEVOPS'].message}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testingProvider === 'AZURE_DEVOPS'}
                  onClick={() => {
                    const org = (document.getElementById('azure-org') as HTMLInputElement)?.value;
                    const proj = (document.getElementById('azure-proj') as HTMLInputElement)?.value;
                    const tok = (document.getElementById('azure-token') as HTMLInputElement)?.value;
                    handleTest(
                      'VCS_PROVIDER',
                      'AZURE_DEVOPS',
                      org && tok ? { orgUrl: org, project: proj, token: tok } : undefined
                    );
                  }}
                  className="text-xs"
                >
                  Testar Conexão
                </Button>
                <Button
                  size="sm"
                  variant="cyan"
                  disabled={savingProvider === 'AZURE_DEVOPS'}
                  onClick={() => {
                    const org = (document.getElementById('azure-org') as HTMLInputElement)?.value;
                    const proj = (document.getElementById('azure-proj') as HTMLInputElement)?.value;
                    const tok = (document.getElementById('azure-token') as HTMLInputElement)?.value;
                    handleSave('VCS_PROVIDER', 'AZURE_DEVOPS', 'Azure DevOps', {
                      orgUrl: org,
                      project: proj,
                      token: tok,
                    });
                  }}
                  className="text-xs"
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GitHub VCS */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-cyan-600 dark:text-cyan-400">
                  GitHub Pull Requests
                </CardTitle>
                <Badge variant="cyan">Branch Alvo: main</Badge>
              </div>
              <CardDescription className="text-xs">
                Abertura de PRs apontando para <code>main</code> com vínculo automático <code>Closes #xx</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">GitHub PAT / Token</label>
                <input
                  type="password"
                  id="github-vcs-token"
                  placeholder="ghp_••••••••••••••••"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              {testResults['GITHUB'] && (
                <div
                  className={`p-2 rounded text-xs flex items-center ${
                    testResults['GITHUB'].ok
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {testResults['GITHUB'].ok ? (
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1 text-rose-500 flex-shrink-0" />
                  )}
                  <span>{testResults['GITHUB'].message}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testingProvider === 'GITHUB'}
                  onClick={() => {
                    const token = (document.getElementById('github-vcs-token') as HTMLInputElement)?.value;
                    handleTest('VCS_PROVIDER', 'GITHUB', token ? { token } : undefined);
                  }}
                  className="text-xs"
                >
                  Testar Conexão
                </Button>
                <Button
                  size="sm"
                  variant="cyan"
                  disabled={savingProvider === 'GITHUB'}
                  onClick={() => {
                    const token = (document.getElementById('github-vcs-token') as HTMLInputElement)?.value;
                    handleSave('VCS_PROVIDER', 'GITHUB', 'GitHub VCS', { token });
                  }}
                  className="text-xs"
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
