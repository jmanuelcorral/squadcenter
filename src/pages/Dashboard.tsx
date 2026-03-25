import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Zap, Terminal } from 'lucide-react';
import { fetchProjects, getSessions } from '../lib/api';
import type { Project } from '@shared/types';
import ProjectCard from '../components/ProjectCard';
import CreateProjectModal from '../components/CreateProjectModal';
import ImportProjectModal from '../components/ImportProjectModal';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeSessionCount, setActiveSessionCount] = useState(0);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));

    getSessions()
      .then((sessions) => setActiveSessionCount(sessions.filter((s) => s.status === 'active').length))
      .catch(() => {});
  }, []);

  function handleCreated(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  function handleImported(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your Squad orchestration projects</p>
        </div>
        <div className="flex items-center gap-3">
          {activeSessionCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Terminal className="w-4 h-4" />
              <span>{activeSessionCount} active session{activeSessionCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 hover:text-white transition-all duration-200"
          >
            <FolderOpen className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-all duration-200 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-slate-800/40 ring-1 ring-white/5 p-5 animate-pulse">
              <div className="h-4 w-32 bg-slate-700/60 rounded mb-3" />
              <div className="h-3 w-48 bg-slate-700/40 rounded mb-4" />
              <div className="h-3 w-full bg-slate-700/30 rounded mb-2" />
              <div className="h-3 w-3/4 bg-slate-700/30 rounded" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-violet-500/10 ring-1 ring-white/5 mb-6">
            <Zap className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No projects yet</h2>
          <p className="text-sm text-slate-400 text-center max-w-sm mb-8">
            Create a new project or import an existing Squad project to get started with orchestration.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 hover:text-white transition-all"
            >
              <FolderOpen className="w-4 h-4" />
              Import Project
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Create First Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {showImport && <ImportProjectModal onClose={() => setShowImport(false)} onImported={handleImported} />}
    </div>
  );
}
