import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, Users, Trash2, Sparkles, Loader2, Square, History, Settings, Pencil, Check, X, Terminal } from 'lucide-react';
import { fetchProject, fetchTeam, deleteProject, startCopilotSession, stopSession, getProjectStatus, updateProject } from '../lib/api';
import type { Project, TeamMember, CopilotConfig } from '@shared/types';
import type { ProjectStatus } from '../lib/api';
import TeamPanel from '../components/TeamPanel';
import SetupHooksButton from '../components/SetupHooksButton';
import SessionHistoryPanel from '../components/SessionHistoryPanel';
import ProjectConfigModal from '../components/ProjectConfigModal';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'team'>('history');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<ProjectStatus | null>(null);
  const [launchingCopilot, setLaunchingCopilot] = useState(false);
  const [stoppingCopilot, setStoppingCopilot] = useState(false);
  const [teamCollapsed, setTeamCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchProject(id),
      fetchTeam(id).catch(() => [] as TeamMember[]),
      getProjectStatus(id).catch(() => null as ProjectStatus | null),
    ]).then(([proj, tm, projStatus]) => {
      setProject(proj);
      setTeam(tm);
      setCopilotStatus(projStatus);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

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
      const session = await startCopilotSession(id, project.path, project.copilotConfig);
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

  function startEditingName() {
    if (!project) return;
    setNameValue(project.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function saveNameEdit() {
    if (!id || !project || !nameValue.trim()) return;
    try {
      const updated = await updateProject(id, { name: nameValue.trim() });
      setProject(updated);
      setEditingName(false);
    } catch {
      // ignore
    }
  }

  async function handleSaveConfig(config: CopilotConfig) {
    if (!id || !project) return;
    try {
      const updated = await updateProject(id, { copilotConfig: config });
      setProject(updated);
      setShowConfigModal(false);
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
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveNameEdit();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="text-2xl font-bold text-white tracking-tight bg-transparent border-b-2 border-violet-500 outline-none px-0 py-0"
                />
                <button onClick={saveNameEdit} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/name">
                <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
                <button
                  onClick={startEditingName}
                  className="p-1 text-slate-600 opacity-0 group-hover/name:opacity-100 hover:text-slate-300 transition-all"
                  title="Edit name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {copilotStatus?.active && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                project.copilotConfig?.startCopilot === false
                  ? 'bg-slate-500/10 text-slate-400 ring-slate-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
              }`}>
                {project.copilotConfig?.startCopilot === false ? 'shell running' : 'copilot running'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 font-mono mt-1">{project.path}</p>
          {project.description && (
            <p className="text-sm text-slate-400 mt-2">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Session CTA */}
          {(() => {
            const isShellMode = project.copilotConfig?.startCopilot === false;
            const SessionIcon = isShellMode ? Terminal : Sparkles;
            const openLabel = isShellMode ? 'Open Shell' : 'Open Copilot';
            const startLabel = isShellMode ? 'Start Shell' : 'Start Copilot';
            const stopLabel = 'Stop';

            return copilotStatus?.active && copilotStatus.sessionId ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/sessions/${copilotStatus.sessionId}`)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ring-1 transition-all ${
                    isShellMode
                      ? 'bg-gradient-to-r from-slate-500/20 to-slate-600/20 text-slate-300 ring-slate-500/30 hover:from-slate-500/30 hover:to-slate-600/30'
                      : 'bg-gradient-to-r from-violet-500/20 to-purple-600/20 text-violet-300 ring-violet-500/30 hover:from-violet-500/30 hover:to-purple-600/30'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${isShellMode ? 'bg-slate-400' : 'bg-violet-400'}`} />
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${isShellMode ? 'bg-slate-500' : 'bg-violet-500'}`} />
                  </span>
                  <SessionIcon className="w-4 h-4" />
                  {openLabel}
                </button>
                <button
                  onClick={handleCopilotStop}
                  disabled={stoppingCopilot}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title={stopLabel}
                >
                  {stoppingCopilot ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  {stopLabel}
                </button>
              </div>
            ) : (
              <button
                onClick={handleCopilotStart}
                disabled={launchingCopilot}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isShellMode
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 shadow-slate-500/20 hover:from-slate-500 hover:to-slate-600'
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/20 hover:from-violet-400 hover:to-purple-500'
                }`}
              >
                {launchingCopilot ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SessionIcon className="w-4 h-4" />
                )}
                {startLabel}
              </button>
            );
          })()}
          <SetupHooksButton projectId={id!} />
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 text-slate-500 hover:text-violet-400 rounded-lg hover:bg-violet-500/10 transition-all"
            title="Session configuration"
          >
            <Settings className="w-4 h-4" />
          </button>
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
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            activeTab === 'history' ? 'bg-white/10 text-white' : 'text-slate-400'
          }`}
        >
          <History className="w-4 h-4" />
          Sessions
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
        {/* Session History — left */}
        <div className={`lg:col-span-2 ${activeTab !== 'history' ? 'hidden lg:block' : ''}`}>
          <SessionHistoryPanel
            projectPath={project.path}
            projectId={id!}
            copilotConfig={project.copilotConfig}
            onSessionStarted={(sessionId) => navigate(`/sessions/${sessionId}`)}
          />
        </div>

        {/* Team Panel — right sidebar (collapsible, static roster) */}
        <div className={`${activeTab !== 'team' ? 'hidden lg:block' : ''}`}>
          <div className="rounded-xl bg-slate-800/40 ring-1 ring-white/10 overflow-hidden">
            <button
              onClick={() => setTeamCollapsed(!teamCollapsed)}
              className="w-full flex items-center gap-2 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Team</h2>
              <span className="text-xs text-slate-500 ml-auto">{team.length} members</span>
              {teamCollapsed ? (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {!teamCollapsed && <TeamPanel members={team} />}
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

      {/* Config modal */}
      {showConfigModal && (
        <ProjectConfigModal
          config={project.copilotConfig || { args: [], envVars: {}, preCommands: [] }}
          onSave={handleSaveConfig}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
}
