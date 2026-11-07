import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';

interface LogMessage {
  taskId: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
  specialistBadge?: string;
  timestamp: string;
}

interface TerminalLogProps {
  taskId?: string;
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ taskId }) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3334';
    const socket = io(wsUrl);
    socketRef.current = socket;

    socket.on('task:log', (log: LogMessage) => {
      if (!taskId || log.taskId === taskId) {
        setLogs((prev) => [...prev, log]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [taskId]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getBadgeColor = (badge?: string) => {
    if (!badge) return 'text-slate-400';
    if (badge.includes('Tech Lead')) return 'text-cyan-400 font-bold';
    if (badge.includes('Database')) return 'text-amber-400 font-bold';
    if (badge.includes('Node')) return 'text-emerald-400 font-bold';
    if (badge.includes('Python')) return 'text-blue-400 font-bold';
    if (badge.includes('Frontend')) return 'text-purple-400 font-bold';
    if (badge.includes('QA')) return 'text-pink-400 font-bold';
    if (badge.includes('Kanbanize')) return 'text-orange-400 font-bold';
    return 'text-cyan-300';
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-rose-400';
      case 'warn':
        return 'text-amber-300';
      case 'success':
        return 'text-emerald-400 font-semibold';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 shadow-2xl flex flex-col h-[380px] overflow-hidden font-mono text-xs">
      {/* Top Header */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-cyan-500" />
          <span className="font-semibold text-slate-200">Terminal da Squad Multi-Agente</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {logs.length} eventos
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1.5 text-[11px] text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Auto-scroll</span>
          </label>

          <Button variant="ghost" size="sm" onClick={clearLogs} className="h-7 px-2 text-slate-400 hover:text-rose-400">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Log Output */}
      <div ref={logContainerRef} className="flex-1 p-4 overflow-y-auto space-y-1.5">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">
            Aguardando eventos dos agentes especialistas...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start space-x-2 leading-relaxed hover:bg-slate-900/40 px-1 py-0.5 rounded">
              <span className="text-slate-600 select-none text-[10px] pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`select-none whitespace-nowrap text-[11px] ${getBadgeColor(log.specialistBadge)}`}>
                [{log.specialistBadge || 'Squad'}]:
              </span>
              <span className={`flex-1 break-all whitespace-pre-wrap ${getTypeStyle(log.type)}`}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
