import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Terminal, Loader2, Clock } from 'lucide-react';
import type { Project } from '@shared/types';
import { getProjectStatus, startSession, getHookEvents } from '../lib/api';
import type { ProjectStatus, HookEvent } from '../lib/api';
import SetupHooksButton from './SetupHooksButton';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [hookEvents, setHookEvents] = useState<HookEvent[]>([]);

  useEffect(() => {
    getProjectStatus(project.id)
      .then(setStatus)
      .catch(() => setStatus(null));
    getHookEvents(project.id, 20)
      .then(setHookEvents)
      .catch(() => setHookEvents([]));
  }, [project.id]);

  async function handleLaunch(e: React.MouseEvent) {
    e.stopPropagation();
    setLaunching(true);
    try {
      const session = await startSession(project.id, project.path);
      navigate(`/sessions/${session.id}`);
    } catch {
      setLaunching(false);
    }
  }

  async function handleEnter(e: React.MouseEvent) {
    e.stopPropagation();
    if (status?.sessionId) {
      navigate(`/sessions/${status.sessionId}`);
    } else {
      // Hook-detected session or no managed session — launch one
      setLaunching(true);
      try {
        const session = await startSession(project.id, project.path);
        navigate(`/sessions/${session.id}`);
      } catch {
        // If launch fails, go to project view (shows hook activity)
        navigate(`/project/${project.id}`);
      } finally {
        setLaunching(false);
      }
    }
  }

  const isActive = status?.active ?? false;

  // Detect active copilot session from hook events (sessionStart without a later sessionEnd)
  const lastStart = hookEvents.filter((e) => e.eventType === 'sessionStart').at(-1);
  const lastEnd = hookEvents.filter((e) => e.eventType === 'sessionEnd').at(-1);
  const hasHookSession = !!lastStart && (!lastEnd || new Date(lastStart.timestamp) > new Date(lastEnd.timestamp));
  const showActive = isActive || hasHookSession;

  // Last activity from hook events
  const lastHookEvent = hookEvents.at(-1);
  const hasRecentHookEvents = hookEvents.length > 0;

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className="group relative flex flex-col rounded-xl bg-slate-800/60 ring-1 ring-white/10 p-5 text-left transition-all duration-200 hover:ring-emerald-500/50 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-emerald-500/5 cursor-pointer"
    >
      {/* Gradient top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500/60 via-violet-500/60 to-emerald-500/0 rounded-t-xl" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Session status dot */}
          <span className="relative shrink-0 flex h-2.5 w-2.5">
            {showActive ? (
              <>
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-600" />
            )}
          </span>
          <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
            {project.name}
          </h3>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            project.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
              : 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/30'
          }`}
        >
          {project.status}
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-500 font-mono truncate">{project.path}</p>

      {project.description && (
        <p className="mt-2 text-sm text-slate-400 line-clamp-2">{project.description}</p>
      )}

      {/* Team member emoji row */}
      {project.team && project.team.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5">
          {project.team.slice(0, 6).map((member) => (
            <div
              key={member.name}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/60 text-sm ring-1 ring-white/5"
              title={`${member.emoji} ${member.name} — ${member.role}`}
            >
              {member.emoji}
            </div>
          ))}
          {project.team.length > 6 && (
            <span className="text-xs text-slate-500 ml-1">+{project.team.length - 6}</span>
          )}
        </div>
      )}

      {/* Footer: time + hook info + session action */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] text-slate-500">
            Updated {timeAgo(project.updatedAt)}
          </p>
          {lastHookEvent && (
            <p className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              Last active: {timeAgo(lastHookEvent.timestamp)}
            </p>
          )}
          {!hasRecentHookEvents && (
            <SetupHooksButton projectId={project.id} inline />
          )}
        </div>

        {showActive ? (
          <button
            onClick={handleEnter}
            className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            {launching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Terminal className="w-3 h-3" />
            )}
            Enter Session
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            className="flex items-center gap-1 rounded-md bg-slate-700/50 px-2 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-slate-600/30 hover:bg-slate-700/80 hover:text-white transition-colors"
          >
            {launching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            Launch Session
          </button>
        )}
      </div>
    </div>
  );
}
