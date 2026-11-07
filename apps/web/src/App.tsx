import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  PlayCircle,
  Bot,
  FolderGit2,
  History,
  Settings,
  Sun,
  Moon,
  Sparkles,
  Server,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  const [activeTab, setActiveTab] = useState<string>('insert');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navItems = [
    { id: 'insert', label: 'Inserir Tarefa', icon: PlusCircle },
    { id: 'execution', label: 'Execução de Tarefa', icon: PlayCircle },
    { id: 'squad', label: 'Squad & OmniRoute', icon: Bot },
    { id: 'repos', label: 'Repositórios', icon: FolderGit2 },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'settings', label: 'Configurações & Integrações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent">
                  Agent Hub
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-medium">
                  Multi-Stack & OmniRoute
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Squad Autônoma de Engenharia Multi-Plataforma
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* OmniRoute Status Pill */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">OmniRoute :20128</span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-cyan-600" />}
            </button>
          </div>
        </div>

        {/* 6 Tabs Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 dark:border-slate-800/60 flex space-x-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-cyan-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'insert' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                <PlusCircle className="w-5 h-5 text-cyan-500" />
                <span>Inserir Nova Tarefa na Fila da Squad</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Conecte cards do Kanbanize, GitHub Issues, Jira, Trello, Linear ou crie tarefas manuais.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'execution' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                <PlayCircle className="w-5 h-5 text-cyan-500" />
                <span>Execução de Tarefa & Diagnóstico Antigravity</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Monitoramento com Human-in-the-Loop, árvore de decisões Grill-Me e relatório final copiável.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'squad' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                <Bot className="w-5 h-5 text-cyan-500" />
                <span>Squad Especialista & Roteamento OmniRoute</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Tech Lead com Gemini 2.5 Pro (Pago) + 5 Especialistas com modelos 100% Free via OmniRoute.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'repos' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                <FolderGit2 className="w-5 h-5 text-cyan-500" />
                <span>Repositórios & Perfis Poliglotas</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Detecção automática de Node/TS, Python, Frontend, Banco de Dados e Branch Alvo de PRs.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                <History className="w-5 h-5 text-cyan-500" />
                <span>Histórico de Tarefas & Relatórios de Entrega</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Histórico com formatação DD/MM/AAAA, soft-delete, restauração e exportação de logs.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-slate-100">
                <Settings className="w-5 h-5 text-cyan-500" />
                <span>Configurações & Conexões de Integração</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Gerencie credenciais criptografadas de Boards (Kanbanize, GitHub, Jira), Git (GitHub, Azure DevOps) e OmniRoute.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
