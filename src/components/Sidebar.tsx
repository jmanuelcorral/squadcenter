import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Terminal, Zap, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import { getSessions, fetchProjects } from '../lib/api';
import type { Session, Project } from '@shared/types';

interface ActiveSession {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  status: string;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [expanded, setExpanded] = useState(true);

  const refreshSessions = useCallback(async () => {
    try {
      const [sessions, projects] = await Promise.all([getSessions(), fetchProjects()]);
      const projectMap = new Map<string, Project>(projects.map(p => [p.id, p]));
      const active = sessions
        .filter(s => s.status === 'active' || s.status === 'starting')
        .map(s => ({
          id: s.id,
          projectId: s.projectId,
          type: s.type ?? 'shell',
          status: s.status,
          projectName: projectMap.get(s.projectId)?.name ?? s.projectPath.split(/[\\/]/).pop() ?? 'Unknown',
        }));
      setActiveSessions(active);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshSessions();
    const interval = setInterval(refreshSessions, 5_000);

    const cleanup = window.electronAPI.on('event:session:status', () => {
      setTimeout(refreshSessions, 300);
    });

    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [refreshSessions]);

  const activeCount = activeSessions.length;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 border-r border-white/5">
      {/* Subtle glow accent on left edge */}
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-emerald-500/0 via-emerald-500/20 to-violet-500/0" />

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 shadow-lg shadow-emerald-500/20">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">
          squad<span className="text-emerald-400">Center</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <LayoutDashboard className="w-4.5 h-4.5" />
          Dashboard
        </NavLink>

        {/* Sessions section */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          <Terminal className="w-4.5 h-4.5" />
          Sessions
          {activeCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              {activeCount}
            </span>
          )}
          {activeCount > 0 && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {/* Active sessions list */}
        {expanded && activeCount > 0 && (
          <div className="ml-4 space-y-0.5 border-l border-white/5 pl-3">
            {activeSessions.map(session => {
              const isCurrentSession = location.pathname === `/sessions/${session.id}`;
              return (
                <button
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-all duration-150 ${
                    isCurrentSession
                      ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    {session.status === 'active' ? (
                      <>
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </>
                    ) : (
                      <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{session.projectName}</p>
                    <p className="text-[10px] text-slate-500">
                      {session.type === 'copilot' ? '✨ Copilot' : '💻 Shell'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {expanded && activeCount === 0 && (
          <p className="ml-10 text-[11px] text-slate-600 py-1">No active sessions</p>
        )}
      </nav>

      {/* Bottom: Notification bell */}
      <div className="border-t border-white/5 px-4 py-3">
        <NotificationPanel />
      </div>
    </aside>
  );
}
