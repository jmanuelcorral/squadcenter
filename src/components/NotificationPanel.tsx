import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, AlertTriangle, Info, Trash2, ExternalLink } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

const typeConfig = {
  success: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  error: { icon: X, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationPanel() {
  const { notifications, unreadCount, markRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-slate-800 ring-1 ring-white/10 shadow-2xl backdrop-blur-xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.map((n) => {
                const config = typeConfig[n.type];
                const Icon = config.icon;
                const hasSession = !!n.sessionId;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (hasSession) {
                        setOpen(false);
                        navigate(`/sessions/${n.sessionId}`);
                      }
                    }}
                    className={`w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors ${
                      n.read ? 'opacity-50' : ''
                    } ${hasSession ? 'cursor-pointer' : ''}`}
                  >
                    <div className={`mt-0.5 p-1 rounded-md ${config.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300">{n.agentName}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      {!n.read && (
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      {hasSession && (
                        <ExternalLink className="w-3 h-3 text-slate-500 mt-1" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
