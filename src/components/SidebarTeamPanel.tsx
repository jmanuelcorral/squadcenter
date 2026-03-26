import { useState, useEffect, useRef } from 'react';
import { Users, RefreshCw, Check, X, Loader2, ChevronRight } from 'lucide-react';
import { fetchTeam, getAgentActivity, refreshAgentActivity } from '../lib/api';
import type { AgentActivity, MemberActivity, SubagentSpawn } from '../lib/api';
import type { TeamMember } from '@shared/types';
import CollapsiblePanel from './CollapsiblePanel';

interface SidebarTeamPanelProps {
  projectId: string;
  sessionId?: string;
  compact?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

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

function sortedSubagents(subs: SubagentSpawn[]): SubagentSpawn[] {
  const order: Record<string, number> = { running: 0, completed: 1, failed: 2 };
  return [...subs].sort(
    (a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3),
  );
}

// ── Subagent card (reused pattern from former AgentActivityPanel) ────────

function SubagentCard({ subagent }: { subagent: SubagentSpawn }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = subagent.status === 'running';
  const badgeColor =
    agentTypeBadgeColors[subagent.agentType] ?? 'bg-slate-500/15 text-slate-300 ring-slate-500/25';

  return (
    <div
      className={`rounded-md border transition-colors ${
        isRunning ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/5 bg-slate-800/50'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronRight
          className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 flex-shrink-0 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
        <StatusIcon status={subagent.status} />
        <span className="text-[11px] text-slate-200 truncate flex-1">{subagent.name}</span>
        <span
          className={`inline-flex rounded-full px-1.5 py-px text-[9px] font-medium ring-1 ${badgeColor}`}
        >
          {subagent.agentType}
        </span>
        <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
          {formatDuration(subagent.startTime, subagent.endTime)}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-white/5">
          {subagent.description && (
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              {subagent.description}
            </p>
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

// ── Member row with expandable subagent list ─────────────────────────────

const liveStatusDot: Record<string, string> = {
  idle: 'bg-slate-500',
  working: 'bg-violet-400 animate-pulse',
  done: 'bg-emerald-400',
};

const staticStatusDot: Record<string, string> = {
  idle: 'bg-emerald-400',
  working: 'bg-violet-400',
  done: 'bg-slate-400',
};

function MemberRow({
  member,
  memberActivity,
}: {
  member: TeamMember;
  memberActivity?: MemberActivity;
}) {
  const [expanded, setExpanded] = useState(false);

  const isWorking = memberActivity?.status === 'working';
  const isDone = memberActivity?.status === 'done';
  const subagents = memberActivity ? sortedSubagents(memberActivity.subagents) : [];
  const runningCount = subagents.filter((s) => s.status === 'running').length;

  // Determine status dot: live data takes precedence
  const dotClass = memberActivity
    ? liveStatusDot[memberActivity.status] ?? 'bg-slate-500'
    : staticStatusDot[member.status] ?? 'bg-slate-500';

  const hasExpandable = subagents.length > 0;

  return (
    <div>
      <button
        onClick={() => hasExpandable && setExpanded((v) => !v)}
        className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 w-full text-left transition-colors ${
          isWorking ? 'bg-violet-500/5 hover:bg-violet-500/10' : 'hover:bg-white/5'
        } ${hasExpandable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-sm leading-none">{member.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{member.name}</p>
          <p className="text-[10px] text-slate-500 truncate">
            {member.role}
            {isWorking && runningCount > 0 && (
              <span className="ml-1 text-violet-400">
                · {runningCount} task{runningCount !== 1 ? 's' : ''} running
              </span>
            )}
            {isDone && <span className="ml-1 text-emerald-400">· done</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasExpandable && (
            <ChevronRight
              className={`w-2.5 h-2.5 text-slate-500 transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          )}
          <div className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        </div>
      </button>

      {/* Expanded subagent list */}
      {expanded && subagents.length > 0 && (
        <div className="ml-7 mr-1 mt-1 mb-2 space-y-1">
          {subagents.map((sub) => (
            <SubagentCard key={sub.id} subagent={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────

export default function SidebarTeamPanel({ projectId, sessionId }: SidebarTeamPanelProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState(false);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Load team members
  useEffect(() => {
    fetchTeam(projectId)
      .then((data) => setMembers(data ?? []))
      .catch(() => setError(true));
  }, [projectId]);

  // Fetch initial activity
  useEffect(() => {
    if (!sessionId) return;
    getAgentActivity(sessionId)
      .then((data) => { if (data) setActivity(data); })
      .catch(() => {});
  }, [sessionId]);

  // Subscribe to live activity broadcasts
  useEffect(() => {
    if (!sessionId) return;
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
    if (!sessionId) return;
    setRefreshing(true);
    try {
      const data = await refreshAgentActivity(sessionId);
      if (data) setActivity(data);
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  // Count members currently working
  const workingCount = activity
    ? Object.values(activity.members).filter((m) => m.status === 'working').length
    : 0;

  return (
    <CollapsiblePanel
      title="Team"
      icon={<Users className="w-3.5 h-3.5" />}
      badge={
        workingCount > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-violet-500/20 px-1.5 py-px text-[9px] font-bold text-violet-300 ring-1 ring-violet-500/30 tabular-nums animate-pulse">
            {workingCount}
          </span>
        ) : members.length > 0 ? (
          <span className="text-[10px] text-slate-500 font-mono">{members.length}</span>
        ) : undefined
      }
      actions={
        sessionId ? (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh activity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        ) : undefined
      }
    >
      {error || members.length === 0 ? (
        <p className="px-4 pb-3 text-[11px] text-slate-500 italic">No team configured</p>
      ) : (
        <div className="px-3 pb-2 space-y-0.5">
          {members.map((member) => {
            const memberAct = activity?.members[member.name.toLowerCase()];
            return (
              <MemberRow key={member.name} member={member} memberActivity={memberAct} />
            );
          })}
        </div>
      )}
    </CollapsiblePanel>
  );
}
