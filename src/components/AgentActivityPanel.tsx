import { useState, useEffect, useRef } from 'react';
import { Cpu, RefreshCw, Check, X, Loader2, ChevronRight, Terminal } from 'lucide-react';
import { getAgentActivity, refreshAgentActivity } from '../lib/api';
import type { AgentActivity, AgentToolCall, SubagentSpawn } from '../lib/api';
import CollapsiblePanel from './CollapsiblePanel';

interface AgentActivityPanelProps {
  sessionId: string;
}

function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function StatusIcon({ status }: { status: 'running' | 'completed' | 'failed' }) {
  if (status === 'running')
    return <Loader2 className="w-3 h-3 text-violet-400 animate-spin flex-shrink-0" />;
  if (status === 'completed')
    return <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />;
  return <X className="w-3 h-3 text-red-400 flex-shrink-0" />;
}

const agentTypeBadgeColors: Record<string, string> = {
  explore: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  task: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
  'general-purpose': 'bg-violet-500/15 text-violet-300 ring-violet-500/25',
  'code-review': 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
};

function SubagentCard({ subagent }: { subagent: SubagentSpawn }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = subagent.status === 'running';
  const badgeColor = agentTypeBadgeColors[subagent.agentType] ?? 'bg-slate-500/15 text-slate-300 ring-slate-500/25';

  return (
    <div
      className={`rounded-md border transition-colors ${
        isRunning
          ? 'border-violet-500/30 bg-violet-500/5'
          : 'border-white/5 bg-slate-800/50'
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronRight
          className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 flex-shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <StatusIcon status={subagent.status} />
        <span className="text-[11px] text-slate-200 truncate flex-1">{subagent.name}</span>
        <span className={`inline-flex rounded-full px-1.5 py-px text-[9px] font-medium ring-1 ${badgeColor}`}>
          {subagent.agentType}
        </span>
        <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
          {formatDuration(subagent.startTime, subagent.endTime)}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-white/5">
          {subagent.description && (
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">{subagent.description}</p>
          )}
          {subagent.result && (
            <div className="mt-1">
              <p className="text-[9px] text-slate-500 mb-0.5">Result</p>
              <pre className="text-[10px] text-slate-300 bg-slate-900/60 rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">
                {subagent.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallRow({ call }: { call: AgentToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-white/5 bg-slate-800/50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronRight
          className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 flex-shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <StatusIcon status={call.status} />
        <span className="text-[11px] text-slate-200 font-mono truncate flex-1">{call.toolName}</span>
        <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
          {formatDuration(call.startTime, call.endTime)}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-white/5">
          {call.model && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              Model: <span className="text-slate-400">{call.model}</span>
            </p>
          )}
          {call.arguments && Object.keys(call.arguments).length > 0 && (
            <div className="mt-1">
              <p className="text-[9px] text-slate-500 mb-0.5">Arguments</p>
              <pre className="text-[10px] text-slate-300 bg-slate-900/60 rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-24 overflow-y-auto font-mono">
                {JSON.stringify(call.arguments, null, 2)}
              </pre>
            </div>
          )}
          {call.result && (
            <div className="mt-1">
              <p className="text-[9px] text-slate-500 mb-0.5">Result</p>
              <pre className="text-[10px] text-slate-300 bg-slate-900/60 rounded px-2 py-1.5 whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">
                {call.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentActivityPanel({ sessionId }: AgentActivityPanelProps) {
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getAgentActivity(sessionId)
      .then((data) => { if (data) setActivity(data); })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const cleanup = window.electronAPI.on('session:agentActivity', (payload: unknown) => {
      const data = payload as { sessionId: string; activity: AgentActivity };
      if (data.sessionId === sessionId) {
        setActivity(data.activity);
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
      const data = await refreshAgentActivity(sessionId);
      if (data) setActivity(data);
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  const runningCount =
    (activity?.subagents.filter((s) => s.status === 'running').length ?? 0) +
    (activity?.toolCalls.filter((t) => t.status === 'running').length ?? 0);

  const recentToolCalls = activity?.toolCalls
    ? [...activity.toolCalls]
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 10)
    : [];

  return (
    <CollapsiblePanel
      title="Agent Activity"
      icon={<Cpu className="w-3.5 h-3.5" />}
      badge={
        runningCount > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-violet-500/20 px-1.5 py-px text-[9px] font-bold text-violet-300 ring-1 ring-violet-500/30 tabular-nums animate-pulse">
            {runningCount}
          </span>
        ) : undefined
      }
      actions={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          title="Refresh activity"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="px-3 pb-3 space-y-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {activity?.isActive ? (
              <>
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-500" />
            )}
          </span>
          <span className={`text-[11px] font-medium ${activity?.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
            {activity?.isActive ? 'Active' : 'Idle'}
          </span>
          {activity?.agentName && (
            <span className="text-[10px] text-slate-500">· {activity.agentName}</span>
          )}
        </div>

        {/* Subagents section */}
        {activity?.subagents && activity.subagents.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Terminal className="w-3 h-3 text-slate-500" />
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subagents</h3>
            </div>
            <div className="space-y-1">
              {activity.subagents.map((sub) => (
                <SubagentCard key={sub.id} subagent={sub} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Tool Calls section */}
        {recentToolCalls.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Cpu className="w-3 h-3 text-slate-500" />
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent Tool Calls</h3>
            </div>
            <div className="space-y-1">
              {recentToolCalls.map((call) => (
                <ToolCallRow key={call.id} call={call} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!activity && (
          <p className="text-[11px] text-slate-500 italic text-center py-2">No activity yet</p>
        )}
      </div>
    </CollapsiblePanel>
  );
}
