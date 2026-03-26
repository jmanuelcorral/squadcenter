import { useState, useEffect, useRef } from 'react';
import { ArrowUpFromLine, Zap, MessageCircle, Wrench, RefreshCw } from 'lucide-react';
import { getSessionStats, refreshSessionStats } from '../lib/api';
import type { SessionStats } from '../lib/api';

interface SessionStatsPanelProps {
  sessionId: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

const statCells = [
  { key: 'tokensOut', label: 'Output', icon: ArrowUpFromLine, color: 'cyan' },
  { key: 'premiumRequests', label: 'Premium', icon: Zap, color: 'amber' },
  { key: 'turns', label: 'Turns', icon: MessageCircle, color: 'indigo' },
  { key: 'toolCalls', label: 'Tool Calls', icon: Wrench, color: 'violet' },
] as const;

const colorMap: Record<string, { bg: string; icon: string; value: string }> = {
  cyan:   { bg: 'bg-cyan-500/5',   icon: 'text-cyan-400',   value: 'text-cyan-300' },
  amber:  { bg: 'bg-amber-500/5',  icon: 'text-amber-400',  value: 'text-amber-300' },
  indigo: { bg: 'bg-indigo-500/5', icon: 'text-indigo-400', value: 'text-indigo-300' },
  violet: { bg: 'bg-violet-500/5', icon: 'text-violet-400', value: 'text-violet-300' },
};

export default function SessionStatsPanel({ sessionId }: SessionStatsPanelProps) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getSessionStats(sessionId)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const cleanup = window.electronAPI.on('event:session:stats', (payload: unknown) => {
      const data = payload as { sessionId: string; stats: SessionStats };
      if (data.sessionId === sessionId) {
        setStats(data.stats);
      }
    });
    cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [sessionId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await refreshSessionStats(sessionId);
      if (data) setStats(data);
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  function displayValue(key: string): string {
    if (!stats) return '—';
    const v = stats[key as keyof SessionStats] as number;
    return v > 0 ? formatNumber(v) : '—';
  }

  return (
    <div className="border-b border-white/5">
      <div className="flex items-center justify-between px-4 py-2.5">
        <h2 className="text-xs font-semibold text-slate-300">Session Stats</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          title="Refresh stats"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-4 pb-3">
        {statCells.map(({ key, label, icon: Icon, color }) => {
          const c = colorMap[color];
          return (
            <div key={key} className={`flex items-center gap-2 rounded-lg ${c.bg} px-3 py-2`}>
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${c.icon}`} />
              <div className="min-w-0">
                <p className="text-[9px] text-slate-500 leading-none">{label}</p>
                <p className={`text-sm font-bold font-mono ${c.value} leading-tight transition-all duration-300`}>
                  {displayValue(key)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
