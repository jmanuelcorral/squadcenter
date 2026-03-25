import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Terminal, Zap } from 'lucide-react';
import NotificationPanel from './NotificationPanel';
import { getSessions } from '../lib/api';

const staticNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
];

export default function Sidebar() {
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    getSessions()
      .then((sessions) => setActiveCount(sessions.filter((s) => s.status === 'active').length))
      .catch(() => {});
    const interval = setInterval(() => {
      getSessions()
        .then((sessions) => setActiveCount(sessions.filter((s) => s.status === 'active').length))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {staticNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5" />
            {label}
          </NavLink>
        ))}

        {/* Sessions link with active count badge */}
        <NavLink
          to="/"
          onClick={(e) => { e.preventDefault(); /* stays on dashboard — sessions are per-project for now */ }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          <Terminal className="w-4.5 h-4.5" />
          Sessions
          {activeCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
              {activeCount}
            </span>
          )}
        </NavLink>
      </nav>

      {/* Bottom: Notification bell */}
      <div className="border-t border-white/5 px-4 py-3">
        <NotificationPanel />
      </div>
    </aside>
  );
}
