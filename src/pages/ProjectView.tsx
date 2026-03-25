import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Activity, Trash2, Radio, Sparkles, Loader2, Square } from 'lucide-react';
import { fetchProject, fetchTeam, fetchLogs, deleteProject, getHookEvents, startCopilotSession, stopSession, getProjectStatus } from '../lib/api';
import type { Project, TeamMember, ChatMessage } from '@shared/types';
import type { HookEvent, ProjectStatus } from '../lib/api';
import TeamPanel from '../components/TeamPanel';
import ActivityFeed from '../components/ActivityFeed';
import ActivityTimeline from '../components/ActivityTimeline';
import SetupHooksButton from '../components/SetupHooksButton';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'team' | 'monitoring'>('activity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hookEventCount, setHookEventCount] = useState(0);
  const [copilotStatus, setCopilotStatus] = useState<ProjectStatus | null>(null);
  const [launchingCopilot, setLaunchingCopilot] = useState(false);
  const [stoppingCopilot, setStoppingCopilot] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchProject(id),
      fetchTeam(id).catch(() => [] as TeamMember[]),
      fetchLogs(id).catch(() => [] as ChatMessage[]),
      getHookEvents(id, 10).catch(() => [] as HookEvent[]),
      getProjectStatus(id).catch(() => null as ProjectStatus | null),
    ]).then(([proj, tm, lg, hookEvts, projStatus]) => {
      setProject(proj);
      setTeam(tm);
      setLogs(lg);
      setHookEventCount(hookEvts.length);
      setCopilotStatus(projStatus);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Auto-scroll to bottom of feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [logs]);

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteProject(id);
      navigate('/');
    } catch {
      // ignore
    }
  }

  async function handleCopilotStart() {
    if (!id || !project) return;
    setLaunchingCopilot(true);
    try {
      const session = await startCopilotSession(id, project.path);
      navigate(`/sessions/${session.id}`);
    } catch {
      setLaunchingCopilot(false);
    }
  }

  async function handleCopilotStop() {
    if (!id || !copilotStatus?.sessionId) return;
    setStoppingCopilot(true);
    try {
      await stopSession(copilotStatus.sessionId);
      const refreshed = await getProjectStatus(id);
      setCopilotStatus(refreshed);
    } catch {
      // ignore
    } finally {
      setStoppingCopilot(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-pulse">
        <div className="h-6 w-48 bg-slate-700/60 rounded mb-4" />
        <div className="h-4 w-64 bg-slate-700/40 rounded mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-800/40 rounded-xl ring-1 ring-white/5" />
          <div className="h-96 bg-slate-800/40 rounded-xl ring-1 ring-white/5" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <p className="text-lg">Project not found</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-3 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to projects
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                project.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/30'
              }`}
            >
              {project.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-mono mt-1">{project.path}</p>
          {project.description && (
            <p className="text-sm text-slate-400 mt-2">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Copilot CTA */}
          {copilotStatus?.active && copilotStatus.sessionId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/sessions/${copilotStatus.sessionId}`)}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500/20 to-purple-600/20 px-4 py-2 text-sm font-medium text-violet-300 ring-1 ring-violet-500/30 hover:from-violet-500/30 hover:to-purple-600/30 transition-all"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                </span>
                <Sparkles className="w-4 h-4" />
                Open Copilot
              </button>
              <button
                onClick={handleCopilotStop}
                disabled={stoppingCopilot}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                title="Stop Copilot"
              >
                {stoppingCopilot ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                Stop
              </button>
            </div>
          ) : (
            <button
              onClick={handleCopilotStart}
              disabled={launchingCopilot}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-400 hover:to-purple-500 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {launchingCopilot ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Start Copilot
            </button>
          )}
          <SetupHooksButton projectId={id!} />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex lg:hidden gap-1 mb-4 bg-slate-800/50 rounded-lg p-1 ring-1 ring-white/5">
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            activeTab === 'activity' ? 'bg-white/10 text-white' : 'text-slate-400'
          }`}
        >
          <Activity className="w-4 h-4" />
          Activity
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            activeTab === 'team' ? 'bg-white/10 text-white' : 'text-slate-400'
          }`}
        >
          <Users className="w-4 h-4" />
          Team
        </button>
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            activeTab === 'monitoring' ? 'bg-white/10 text-white' : 'text-slate-400'
          }`}
        >
          <Radio className="w-4 h-4" />
          Monitoring
          {hookEventCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[10px] font-bold text-emerald-400">
              {hookEventCount}
            </span>
          )}
        </button>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Activity Feed — left */}
        <div className={`lg:col-span-2 ${activeTab !== 'activity' ? 'hidden lg:block' : ''}`}>
          <div className="rounded-xl bg-slate-800/40 ring-1 ring-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <Activity className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Activity</h2>
              <span className="text-xs text-slate-500 ml-auto">{logs.length} entries</span>
            </div>
            <div ref={feedRef} className="max-h-[calc(100vh-320px)] overflow-y-auto">
              <ActivityFeed messages={logs} />
            </div>
          </div>
        </div>

        {/* Hook Events Timeline — center */}
        <div className={`${activeTab !== 'monitoring' ? 'hidden lg:block' : ''}`}>
          <div className="rounded-xl bg-slate-800/40 ring-1 ring-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Monitoring</h2>
              {hookEventCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500/15 px-1 text-[10px] font-bold text-cyan-400 ml-auto">
                  {hookEventCount}
                </span>
              )}
            </div>
            <div className="max-h-[calc(100vh-320px)] overflow-hidden">
              <ActivityTimeline projectId={id!} />
            </div>
          </div>
        </div>

        {/* Team Panel — right sidebar */}
        <div className={`${activeTab !== 'team' ? 'hidden lg:block' : ''}`}>
          <div className="rounded-xl bg-slate-800/40 ring-1 ring-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Team</h2>
              <span className="text-xs text-slate-500 ml-auto">{team.length} members</span>
            </div>
            <TeamPanel members={team} />
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-800 ring-1 ring-white/10 shadow-2xl p-6 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20 mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Delete Project?</h3>
            <p className="text-sm text-slate-400 mb-6">This will remove "{project.name}" from squadCenter. Your files won't be affected.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
