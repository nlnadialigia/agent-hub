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
} from 'lucide-react';
import { AgentHubApi } from './services/api';
import { TaskInsertTab } from './components/tabs/TaskInsertTab';
import { TaskExecutionTab } from './components/tabs/TaskExecutionTab';
import { SquadOmniRouteTab } from './components/tabs/SquadOmniRouteTab';
import { RepositoriesTab } from './components/tabs/RepositoriesTab';
import { HistoryTab } from './components/tabs/HistoryTab';
import { SettingsIntegrationsTab } from './components/tabs/SettingsIntegrationsTab';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  const [activeTab, setActiveTab] = useState<string>('insert');
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [omniOnline, setOmniOnline] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const h = await AgentHubApi.getOmniHealth();
      setOmniOnline(h.status === 'online');
    } catch {
      setOmniOnline(false);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleTaskCreated = (taskId: string) => {
    setSelectedTaskId(taskId);
    setActiveTab('execution');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('insert')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-500 bg-clip-text text-transparent">
                  Agent Hub
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-semibold tracking-wide">
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
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${omniOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {omniOnline ? 'OmniRoute Online :20128' : 'OmniRoute :20128'}
              </span>
            </div>

            {/* Alternador de Tema Light / Dark Mode */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-cyan-600" />
              )}
            </button>
          </div>
        </div>

        {/* 6 Tabs MenuBar */}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'insert' && (
          <TaskInsertTab
            onTaskCreated={handleTaskCreated}
            onNavigateToExecution={(taskId) => {
              setSelectedTaskId(taskId);
              setActiveTab('execution');
            }}
          />
        )}

        {activeTab === 'execution' && (
          <TaskExecutionTab
            selectedTaskId={selectedTaskId}
            onSelectTask={(id) => setSelectedTaskId(id)}
          />
        )}

        {activeTab === 'squad' && <SquadOmniRouteTab />}

        {activeTab === 'repos' && <RepositoriesTab />}

        {activeTab === 'history' && (
          <HistoryTab
            onNavigateToExecution={(taskId) => {
              setSelectedTaskId(taskId);
              setActiveTab('execution');
            }}
          />
        )}

        {activeTab === 'settings' && <SettingsIntegrationsTab />}
      </main>
    </div>
  );
}
