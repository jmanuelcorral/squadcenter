import { useState } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { importProject } from '../lib/api';
import type { Project } from '@shared/types';

interface Props {
  onClose: () => void;
  onImported: (project: Project) => void;
}

export default function ImportProjectModal({ onClose, onImported }: Props) {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState<Project | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!path.trim()) return;
    setLoading(true);
    setError('');
    try {
      const project = await importProject(path.trim());
      setImported(project);
      onImported(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-slate-800 ring-1 ring-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-violet-400" />
            Import Project
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {imported ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-4">
              <p className="text-sm font-medium text-emerald-400">✓ Project imported successfully!</p>
              <p className="text-sm text-slate-300 mt-1">{imported.name}</p>
            </div>
            {imported.team && imported.team.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Team members found:</p>
                <div className="flex flex-wrap gap-2">
                  {imported.team.map((m) => (
                    <span key={m.name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/5">
                      {m.emoji} {m.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-all">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Path</label>
              <p className="text-xs text-slate-500 mb-2">Enter the path to a directory containing a <code className="text-violet-400">.squad/</code> folder.</p>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/home/user/projects/my-project"
                required
                className="w-full rounded-lg border-0 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500/50 outline-none transition-all font-mono"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !path.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20"
              >
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
