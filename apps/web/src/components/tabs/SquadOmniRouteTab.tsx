import React, { useState, useEffect } from 'react';
import {
  Bot,
  RefreshCw,
  Cpu,
  Sliders,
  ShieldCheck,
  Check,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';
import { AgentHubApi } from '../../services/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

export const SquadOmniRouteTab: React.FC = () => {
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [allowedModels, setAllowedModels] = useState<any[]>([]);
  const [omniHealth, setOmniHealth] = useState<any>({ status: 'checking', baseUrl: 'http://localhost:20128/v1' });
  const [syncing, setSyncing] = useState(false);
  const [savedRole, setSavedRole] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [specs, models, health] = await Promise.all([
        AgentHubApi.getSquadSpecialists(),
        AgentHubApi.getAllowedModels(),
        AgentHubApi.getOmniHealth(),
      ]);
      setSpecialists(specs);
      setAllowedModels(models);
      setOmniHealth(health);
    } catch {
      // Falha silenciosa
    }
  };

  const handleSyncFree = async () => {
    setSyncing(true);
    try {
      const res = await AgentHubApi.syncFreeModels();
      alert(`Sincronização concluída! ${res.added} novos modelos gratuitos adicionados ao catálogo.`);
      await loadData();
    } catch (err: any) {
      alert(`Falha na sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateSpecialist = async (role: string, updatedFields: any) => {
    try {
      await AgentHubApi.updateSpecialist(role, updatedFields);
      setSavedRole(role);
      setTimeout(() => setSavedRole(null), 2000);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar especialista: ${err.message}`);
    }
  };

  const freeCount = allowedModels.filter((m) => m.costTier === 'FREE').length;
  const paidCount = allowedModels.filter((m) => m.costTier === 'PAID').length;

  return (
    <div className="space-y-8">
      {/* Top Banner de Status do OmniRoute */}
      <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/10">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-400/30">
                <Cpu className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Squad Especialista & Roteamento OmniRoute
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      omniHealth.status === 'online'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        omniHealth.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {omniHealth.status === 'online' ? 'OmniRoute Online :20128' : 'OmniRoute Offline'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Catálogo Controlado: <strong>{freeCount} Free</strong> / <strong>{paidCount} Pago (Gemini 2.5 Pro)</strong>. Especialistas rodam 100% grátis.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFree}
              disabled={syncing}
              className="border-cyan-400/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Modelos Free'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid com os 6 Agentes Especialistas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {specialists.map((agent) => (
          <Card key={agent.id} className="border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 transition">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base text-cyan-700 dark:text-cyan-300">
                    {agent.displayName}
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {agent.description}
                  </CardDescription>
                </div>
                {agent.role === 'ORCHESTRATOR' ? (
                  <Badge variant="cyan">💳 Pago Default</Badge>
                ) : (
                  <Badge variant="success">🟢 100% Free</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              {/* Modelo Principal */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Modelo Principal
                </label>
                <select
                  value={agent.primaryModel}
                  onChange={(e) => handleUpdateSpecialist(agent.role, { primaryModel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {allowedModels.map((m) => (
                    <option key={m.modelId} value={m.modelId}>
                      {m.displayName} ({m.costTier})
                    </option>
                  ))}
                </select>
              </div>

              {/* Modelo de Fallback */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Modelo Fallback (Cota Esgotada)
                </label>
                <select
                  value={agent.fallbackModel}
                  onChange={(e) => handleUpdateSpecialist(agent.role, { fallbackModel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  {allowedModels.map((m) => (
                    <option key={m.modelId} value={m.modelId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperatura */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Temperatura / Criatividade</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">{agent.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={agent.temperature}
                  onChange={(e) => handleUpdateSpecialist(agent.role, { temperature: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Feedback de Salvo */}
              {savedRole === agent.role && (
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs flex items-center">
                  <Check className="w-3.5 h-3.5 mr-1" /> Configuração atualizada no banco!
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
