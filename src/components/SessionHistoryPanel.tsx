import { useState, useEffect } from 'react';
import { History, Zap, MessageCircle, Wrench, Users, ChevronRight, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getSessionHistory } from '../lib/api';
import type { SessionHistoryEntry } from '../lib/api';

// Sigma icon inline (lucide-react doesn't export it directly in all versions)
function SigmaIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6H6l6 6-6 6h12" />
    </svg>
  );
}

interface SessionHistoryPanelProps {
  projectPath: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function SessionCard({ entry, index }: { entry: SessionHistoryEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const { stats, agentSummary, members } = entry;

  return (
    <div className="rounded-lg bg-slate-800/60 ring-1 ring-white/5 overflow-hidden transition-all hover:ring-white/10">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-violet-500/10 text-violet-400 text-[10px] font-bold flex-shrink-0">
          #{index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">
            Session {entry.id.slice(0, 8)}
          </p>
          <p className="text-[10px] text-slate-500">{timeAgo(entry.startedAt)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {stats.turns > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-400">
              <MessageCircle className="w-3 h-3" />
              {stats.turns}
            </span>
          )}
          {agentSummary.total > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-violet-400">
              <Users className="w-3 h-3" />
              {agentSummary.total}
            </span>
          )}
          <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <div className="flex items-center gap-2 rounded-md bg-teal-500/5 px-2.5 py-1.5">
              <ArrowDownToLine className="w-3 h-3 text-teal-400 flex-shrink-0" />
              <div>
                <p className="text-[8px] text-slate-500 leading-none">Input</p>
                <p className="text-[11px] font-bold font-mono text-teal-300">{formatNumber(stats.inputTokens)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-cyan-500/5 px-2.5 py-1.5">
              <ArrowUpFromLine className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <div>
                <p className="text-[8px] text-slate-500 leading-none">Output</p>
                <p className="text-[11px] font-bold font-mono text-cyan-300">{formatNumber(stats.outputTokens)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-sky-500/5 px-2.5 py-1.5">
              <SigmaIcon className="w-3 h-3 text-sky-400 flex-shrink-0" />
              <div>
                <p className="text-[8px] text-slate-500 leading-none">Total</p>
                <p className="text-[11px] font-bold font-mono text-sky-300">{formatNumber(stats.totalTokens)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-amber-500/5 px-2.5 py-1.5">
              <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-[8px] text-slate-500 leading-none">Premium</p>
                <p className="text-[11px] font-bold font-mono text-amber-300">{formatNumber(stats.premiumRequests)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-indigo-500/5 px-2.5 py-1.5">
              <MessageCircle className="w-3 h-3 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-[8px] text-slate-500 leading-none">Turns</p>
                <p className="text-[11px] font-bold font-mono text-indigo-300">{formatNumber(stats.turns)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-violet-500/5 px-2.5 py-1.5">
              <Wrench className="w-3 h-3 text-violet-400 flex-shrink-0" />
              <div>
                <p className="text-[8px] text-slate-500 leading-none">Tool Calls</p>
                <p className="text-[11px] font-bold font-mono text-violet-300">{formatNumber(stats.toolCalls)}</p>
              </div>
            </div>
          </div>

          {/* Agent summary */}
          {agentSummary.total > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-500">Agents:</span>
              <span className="text-emerald-400">{agentSummary.completed} ✓</span>
              {agentSummary.failed > 0 && <span className="text-red-400">{agentSummary.failed} ✗</span>}
              {agentSummary.running > 0 && <span className="text-violet-400">{agentSummary.running} ⏳</span>}
            </div>
          )}

          {/* Members who worked */}
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {members.map(name => (
                <span
                  key={name}
                  className="inline-flex rounded-full bg-slate-700/60 px-2 py-0.5 text-[9px] font-medium text-slate-300 ring-1 ring-white/5 capitalize"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionHistoryPanel({ projectPath }: SessionHistoryPanelProps) {
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessionHistory(projectPath)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [projectPath]);

  // Aggregate totals
  const totals = history.reduce(
    (acc, entry) => ({
      turns: acc.turns + entry.stats.turns,
      premium: acc.premium + entry.stats.premiumRequests,
      inputTokens: acc.inputTokens + entry.stats.inputTokens,
      outputTokens: acc.outputTokens + entry.stats.outputTokens,
      totalTokens: acc.totalTokens + entry.stats.totalTokens,
      tools: acc.tools + entry.stats.toolCalls,
      agents: acc.agents + entry.agentSummary.total,
    }),
    { turns: 0, premium: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, tools: 0, agents: 0 },
  );

  return (
    <div className="rounded-xl bg-slate-800/40 ring-1 ring-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <History className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-white">Session History</h2>
        <span className="text-xs text-slate-500 ml-auto">
          {loading ? '...' : `${history.length} sessions`}
        </span>
      </div>

      {/* Aggregate stats bar */}
      {!loading && history.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-slate-900/30 flex-wrap">
          <span className="text-[10px] text-slate-500">Totals:</span>
          <span className="flex items-center gap-1 text-[10px] text-teal-400">
            <ArrowDownToLine className="w-3 h-3" />
            {formatNumber(totals.inputTokens)} in
          </span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-400">
            <ArrowUpFromLine className="w-3 h-3" />
            {formatNumber(totals.outputTokens)} out
          </span>
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <Zap className="w-3 h-3" />
            {formatNumber(totals.premium)} premium
          </span>
          <span className="flex items-center gap-1 text-[10px] text-indigo-400">
            <MessageCircle className="w-3 h-3" />
            {formatNumber(totals.turns)} turns
          </span>
          {totals.agents > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-violet-400">
              <Users className="w-3 h-3" />
              {totals.agents} agents
            </span>
          )}
        </div>
      )}

      <div className="max-h-[calc(100vh-380px)] overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-8 italic">
            No previous sessions found
          </p>
        ) : (
          history.map((entry, i) => (
            <SessionCard key={entry.id} entry={entry} index={i} />
          ))
        )}
      </div>
    </div>
  );
}
