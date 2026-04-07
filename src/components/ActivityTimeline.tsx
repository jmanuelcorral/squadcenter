import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, MessageSquare, Wrench, CheckCircle2, XCircle,
  AlertTriangle, Filter, Radio,
} from 'lucide-react';
import { getHookEvents } from '../lib/api';
import type { HookEvent, HookEventType } from '../lib/api';
import { useIpcEvents } from '../hooks/useIpcEvents';

// ── Event type metadata ────────────────────────────────────────────────

interface EventMeta {
  icon: typeof Play;
  color: string;        // Tailwind text color
  bg: string;           // Tailwind bg for the icon circle
  border: string;       // Left-border accent
  label: string;
}

const eventMeta: Record<HookEventType, EventMeta> = {
  sessionStart: {
    icon: Play,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-l-emerald-500',
    label: 'Session',
  },
  sessionEnd: {
    icon: Square,
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-l-red-500',
    label: 'Session',
  },
  userPromptSubmitted: {
    icon: MessageSquare,
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-l-blue-500',
    label: 'Prompt',
  },
  preToolUse: {
    icon: Wrench,
    color: 'text-orange-400',
    bg: 'bg-orange-500/15',
    border: 'border-l-orange-500',
    label: 'Tool',
  },
  postToolUse: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-l-emerald-500',
    label: 'Tool Result',
  },
  errorOccurred: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-l-red-500',
    label: 'Error',
  },
};

const allEventTypes: HookEventType[] = [
  'sessionStart', 'sessionEnd', 'userPromptSubmitted',
  'preToolUse', 'postToolUse', 'errorOccurred',
];

const filterLabels: Record<HookEventType, string> = {
  sessionStart: 'Start',
  sessionEnd: 'End',
  userPromptSubmitted: 'Prompt',
  preToolUse: 'Tool',
  postToolUse: 'Result',
  errorOccurred: 'Error',
};

// ── Relative time helper ───────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Event description builder ──────────────────────────────────────────

function describeEvent(e: HookEvent): { title: string; detail?: string } {
  const d = e.data ?? {};
  switch (e.eventType) {
    case 'sessionStart':
      return { title: 'Session started', detail: d.sessionId ? `Session ${String(d.sessionId).slice(0, 8)}` : undefined };
    case 'sessionEnd':
      return { title: `Session ended${d.reason ? ` (${d.reason})` : ''}` };
    case 'userPromptSubmitted':
      return { title: 'Prompt submitted', detail: d.prompt ? String(d.prompt).slice(0, 160) : undefined };
    case 'preToolUse': {
      const tool = d.toolName ?? 'unknown';
      const desc = d.description ?? d.input ?? '';
      return { title: `Using ${tool}`, detail: desc ? String(desc).slice(0, 120) : undefined };
    }
    case 'postToolUse': {
      const tool = d.toolName ?? 'tool';
      const ok = d.resultType !== 'error' && d.resultType !== 'failure';
      return {
        title: `${tool} ${ok ? 'succeeded' : 'failed'}`,
        detail: d.result ? String(d.result).slice(0, 120) : undefined,
      };
    }
    case 'errorOccurred':
      return { title: 'Error occurred', detail: d.message ?? d.error ?? undefined };
    default:
      return { title: e.eventType };
  }
}

// ── Component props ────────────────────────────────────────────────────

interface ActivityTimelineProps {
  projectId: string;
  /** Compact mode hides filters + uses narrower cards (for sidebar panels) */
  compact?: boolean;
}

// ── ActivityTimeline ───────────────────────────────────────────────────

export default function ActivityTimeline({ projectId, compact = false }: ActivityTimelineProps) {
  const [events, setEvents] = useState<HookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<HookEventType>>(new Set(allEventTypes));
  const [isLive, setIsLive] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { messages: ipcMessages } = useIpcEvents();
  const lastProcessedIdRef = useRef(-1);

  // Initial fetch
  useEffect(() => {
    getHookEvents(projectId, 100)
      .then((data) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Subscribe to real-time hook events via IPC
  useEffect(() => {
    if (ipcMessages.length === 0) return;

    const newMessages = ipcMessages.filter(m => m.id > lastProcessedIdRef.current);
    if (newMessages.length === 0) return;
    lastProcessedIdRef.current = newMessages[newMessages.length - 1].id;

    const hookEvents = newMessages
      .filter(m => m.type === 'hook:event')
      .map(m => m.payload as { projectPath?: string; event?: HookEvent })
      .filter(p => p.event && p.event.projectId === projectId)
      .map(p => p.event!);

    if (hookEvents.length > 0) {
      setEvents((prev) => [...prev, ...hookEvents]);
    }
  }, [ipcMessages, projectId]);

  // Auto-scroll when new events come in and live mode is on
  useEffect(() => {
    if (isLive && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, isLive]);

  // Update relative timestamps every 15s
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const toggleFilter = useCallback((type: HookEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const filtered = events.filter((e) => activeFilters.has(e.eventType));

  // Check for active copilot session
  const hasActiveSession = events.some((e) => e.eventType === 'sessionStart') &&
    !events.some(
      (e) =>
        e.eventType === 'sessionEnd' &&
        new Date(e.timestamp).getTime() >=
          Math.max(...events.filter((x) => x.eventType === 'sessionStart').map((x) => new Date(x.timestamp).getTime())),
    );

  // ── Skeleton loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 p-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-700/50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-slate-700/50" />
              <div className="h-3 w-48 rounded bg-slate-700/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar with live indicator + filters */}
      {!compact && (
        <div className="px-4 py-3 border-b border-white/5 space-y-3">
          {/* Live indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`w-3.5 h-3.5 ${hasActiveSession ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-xs font-medium text-slate-300">
                {hasActiveSession ? 'Live' : 'Idle'}
              </span>
              {hasActiveSession && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </div>
            <button
              onClick={() => setIsLive((v) => !v)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                isLive
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                  : 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/30'
              }`}
            >
              {isLive ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </button>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3 h-3 text-slate-500 mr-1" />
            {allEventTypes.map((type) => {
              const meta = eventMeta[type];
              const active = activeFilters.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
                    active
                      ? `${meta.bg} ${meta.color} ring-1 ring-current/20`
                      : 'bg-slate-800/50 text-slate-500 ring-1 ring-slate-700/30'
                  }`}
                >
                  {filterLabels[type]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Radio className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">No hook events yet</p>
            <p className="text-xs text-slate-600 mt-1">Events will appear here as Copilot works</p>
          </div>
        )}

        {filtered.map((event, idx) => {
          const meta = eventMeta[event.eventType] ?? eventMeta.errorOccurred;
          const { title, detail } = describeEvent(event);
          const Icon = event.eventType === 'postToolUse' && event.data?.resultType === 'error'
            ? XCircle
            : meta.icon;
          const iconColor = event.eventType === 'postToolUse' && event.data?.resultType === 'error'
            ? 'text-red-400'
            : meta.color;

          const isNew = idx >= events.length - 3;

          return (
            <div
              key={event.id}
              className={`group flex gap-3 rounded-lg border-l-2 ${meta.border} bg-slate-800/30 hover:bg-slate-800/50 px-3 py-2.5 transition-colors ${isNew ? 'animate-fade-in-up' : ''}`}
            >
              {/* Icon */}
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-white">{title}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{relativeTime(event.timestamp)}</span>
                </div>
                {detail && (
                  <p className={`text-[11px] text-slate-400 mt-0.5 ${compact ? 'truncate' : 'line-clamp-2'} break-words`}>
                    {detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
