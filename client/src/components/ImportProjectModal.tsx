import { useState, useEffect, useCallback } from 'react';
import {
  X, FolderOpen, Folder, ChevronRight, ArrowUp, Home,
  Check, AlertTriangle, Loader2,
} from 'lucide-react';
import { importProject, browseFolders } from '../lib/api';
import type { BrowseResult, DirectoryEntry } from '../lib/api';
import type { Project } from '@shared/types';

interface Props {
  onClose: () => void;
  onImported: (project: Project) => void;
}

function pathSegments(currentPath: string): { label: string; path: string }[] {
  // Handle Windows (D:\foo\bar) and Unix (/foo/bar)
  const isWindows = /^[A-Z]:\\/i.test(currentPath);
  const sep = isWindows ? '\\' : '/';
  const parts = currentPath.split(sep).filter(Boolean);
  const segments: { label: string; path: string }[] = [];

  for (let i = 0; i < parts.length; i++) {
    const path = isWindows
      ? parts.slice(0, i + 1).join(sep) + (i === 0 ? sep : '')
      : sep + parts.slice(0, i + 1).join(sep);
    segments.push({ label: parts[i], path });
  }
  return segments;
}

function SkeletonRows() {
  return (
    <div className="space-y-1.5 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 animate-pulse">
          <div className="w-4 h-4 rounded bg-slate-700" />
          <div className="h-3.5 rounded bg-slate-700" style={{ width: `${40 + Math.random() * 30}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function ImportProjectModal({ onClose, onImported }: Props) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browsing, setBrowsing] = useState(true);
  const [browseError, setBrowseError] = useState('');

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [imported, setImported] = useState<Project | null>(null);
  const [currentHasSquad, setCurrentHasSquad] = useState(false);

  const navigate = useCallback(async (path?: string) => {
    setBrowsing(true);
    setBrowseError('');
    setImportError('');
    try {
      const data = await browseFolders(path);
      setBrowseData(data);
      // Check if the current directory itself has .squad/
      if (data.currentPath) {
        try {
          const parent = await browseFolders(data.parentPath ?? undefined);
          const self = parent.entries.find(e => e.path === data.currentPath);
          setCurrentHasSquad(self?.hasSquadFolder ?? false);
        } catch {
          setCurrentHasSquad(false);
        }
      } else {
        setCurrentHasSquad(false);
      }
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setBrowsing(false);
    }
  }, []);

  useEffect(() => {
    navigate();
  }, [navigate]);

  const handleEntryClick = useCallback((entry: DirectoryEntry) => {
    if (entry.isDirectory) {
      navigate(entry.path);
    }
  }, [navigate]);

  const handleImport = useCallback(async () => {
    if (!browseData?.currentPath) return;
    setImporting(true);
    setImportError('');
    try {
      const project = await importProject(browseData.currentPath);
      setImported(project);
      onImported(project);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import project');
    } finally {
      setImporting(false);
    }
  }, [browseData, onImported]);

  const handleImportEntry = useCallback(async (entry: DirectoryEntry) => {
    setImporting(true);
    setImportError('');
    try {
      const project = await importProject(entry.path);
      setImported(project);
      onImported(project);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import project');
    } finally {
      setImporting(false);
    }
  }, [onImported]);

  const segments = browseData ? pathSegments(browseData.currentPath) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-slate-800 ring-1 ring-white/10 shadow-2xl flex flex-col">
        {/* Header */}
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
          /* ── Success state ── */
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
          <>
            {/* ── Breadcrumb bar ── */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => navigate()}
                className="shrink-0 p-1 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-all duration-150"
                title="Root"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
              {segments.map((seg, i) => (
                <span key={seg.path} className="flex items-center gap-1 shrink-0">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <button
                    onClick={() => navigate(seg.path)}
                    className={`text-xs px-1.5 py-0.5 rounded transition-all duration-150 ${
                      i === segments.length - 1
                        ? 'text-white font-medium'
                        : 'text-slate-500 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {seg.label}
                  </button>
                </span>
              ))}
            </div>

            {/* ── Folder list ── */}
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {browsing ? (
                <SkeletonRows />
              ) : browseError ? (
                <div className="flex items-center gap-2 p-4 m-2 rounded-lg bg-red-500/10 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {browseError}
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {/* Parent directory */}
                  {browseData?.parentPath !== null && browseData?.parentPath !== undefined && (
                    <button
                      onClick={() => navigate(browseData.parentPath!)}
                      className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150"
                    >
                      <ArrowUp className="w-4 h-4" />
                      <span>Parent directory</span>
                    </button>
                  )}

                  {/* Entries */}
                  {browseData?.entries.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">No folders here</p>
                  )}

                  {browseData?.entries.map((entry) => {
                    return (
                      <div
                        key={entry.path}
                        className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-all duration-150 group ${
                          entry.hasSquadFolder ? 'ring-1 ring-emerald-500/20 hover:ring-emerald-500/40' : 'hover:bg-white/5'
                        }`}
                      >
                        <button
                          onClick={() => handleEntryClick(entry)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {entry.hasSquadFolder ? (
                            <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 text-slate-400 group-hover:text-slate-300 shrink-0 transition-colors" />
                          )}

                          <span className={`truncate ${entry.hasSquadFolder ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}>
                            {entry.name}
                          </span>
                        </button>

                        {entry.hasSquadFolder && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleImportEntry(entry); }}
                            disabled={importing}
                            className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 hover:ring-emerald-500/40 transition-all cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            Import
                          </button>
                        )}

                        {!entry.hasSquadFolder && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-white/5 p-4 space-y-3">
              {/* Current path display */}
              {browseData?.currentPath && (
                <div className="flex items-start gap-2">
                  <FolderOpen className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-300 truncate">{browseData.currentPath}</p>
                    {!currentHasSquad && browseData.currentPath && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                        Click a folder to navigate into it. Folders with Squad badge can be imported directly.
                      </p>
                    )}
                    {currentHasSquad && (
                      <p className="flex items-center gap-1 text-[11px] text-emerald-400/80 mt-1">
                        <Check className="w-3 h-3 shrink-0" />
                        This folder has a .squad/ directory
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importError && (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{importError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                {browseData?.currentPath && currentHasSquad && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {importing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Import This Folder
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
