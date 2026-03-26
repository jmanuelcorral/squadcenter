import { useState, useEffect, useRef, useCallback } from 'react';
import { Coins, Zap } from 'lucide-react';
import { getSessionStats } from '../lib/api';
import type { SessionStats } from '../lib/api';

interface SessionStatsPanelProps {
  sessionId: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function SessionStatsPanel({ sessionId }: SessionStatsPanelProps) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Fetch initial stats
  useEffect(() => {
    getSessionStats(sessionId)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, [sessionId]);

  // Listen for real-time stats updates (direct IPC, not via useIpcEvents)
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

  const tokensDisplay = stats && stats.tokensTotal > 0 ? formatNumber(stats.tokensTotal) : '—';
  const premiumDisplay = stats && stats.premiumRequests > 0 ? stats.premiumRequests.toString() : '—';

  return (
    <div className="border-b border-white/5">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <h2 className="text-xs font-semibold text-slate-300">Session Stats</h2>
      </div>
      <div className="flex items-center gap-4 px-4 pb-3">
        {/* Tokens */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10">
            <Coins className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 leading-none mb-0.5">Tokens</p>
            <p className="text-sm font-semibold font-mono text-cyan-300 leading-none transition-all duration-300">
              {tokensDisplay}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-white/5" />

        {/* Premium Requests */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 leading-none mb-0.5">Premium</p>
            <p className="text-sm font-semibold font-mono text-amber-300 leading-none transition-all duration-300">
              {premiumDisplay}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
