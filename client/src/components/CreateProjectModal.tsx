import { useState } from 'react';
import { X } from 'lucide-react';
import { createProject } from '../lib/api';
import type { Project } from '@shared/types';

interface Props {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export default function CreateProjectModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    setLoading(true);
    setError('');
    try {
      const project = await createProject({ name: name.trim(), path: path.trim(), description: description.trim() || undefined });
      onCreated(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-slate-800 ring-1 ring-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              required
              className="w-full rounded-lg border-0 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/projects/my-project"
              required
              className="w-full rounded-lg border-0 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description <span className="text-slate-500">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={3}
              className="w-full rounded-lg border-0 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !path.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
