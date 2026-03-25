import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Activity, Trash2 } from 'lucide-react';
import { fetchProject, fetchTeam, fetchLogs, deleteProject } from '../lib/api';
import type { Project, TeamMember, ChatMessage } from '@shared/types';
import TeamPanel from '../components/TeamPanel';
import ActivityFeed from '../components/ActivityFeed';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'team'>('activity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchProject(id),
      fetchTeam(id).catch(() => [] as TeamMember[]),
      fetchLogs(id).catch(() => [] as ChatMessage[]),
    ]).then(([proj, tm, lg]) => {
      setProject(proj);
      setTeam(tm);
      setLogs(lg);
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

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
          title="Delete project"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed — left (main area) */}
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
