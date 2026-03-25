import { useState } from 'react';
import { Settings, Check, Loader2, Info } from 'lucide-react';
import { setupProjectHooks } from '../lib/api';

interface SetupHooksButtonProps {
  projectId: string;
  /** When true, render as a small link-style button (for use in cards) */
  inline?: boolean;
}

export default function SetupHooksButton({ projectId, inline = false }: SetupHooksButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [hooksPath, setHooksPath] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  async function handleSetup() {
    if (status === 'loading' || status === 'success') return;
    setStatus('loading');
    try {
      const result = await setupProjectHooks(projectId);
      if (result.success) {
        setHooksPath(result.hooksPath);
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  // Inline link style for cards
  if (inline) {
    if (status === 'success') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
          <Check className="w-3 h-3" />
          Monitoring Active
        </span>
      );
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleSetup(); }}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-400 transition-colors"
      >
        {status === 'loading' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Settings className="w-3 h-3" />
        )}
        Setup Hooks
      </button>
    );
  }

  // Full button style
  if (status === 'success') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20 animate-live-pulse">
          <Check className="w-3.5 h-3.5" />
          Monitoring Active ✓
        </div>
        {hooksPath && (
          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]" title={hooksPath}>
            {hooksPath}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSetup}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
        >
          {status === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Settings className="w-3.5 h-3.5" />
          )}
          Setup Monitoring
        </button>

        {/* Info tooltip trigger */}
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-lg bg-slate-800 ring-1 ring-white/10 shadow-xl p-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Installs Copilot CLI hooks into this project. Once active, every Copilot session, prompt,
            and tool call will stream live events to this dashboard.
          </p>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
            <Settings className="w-3 h-3" />
            Creates .copilot/hooks/ in your project
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <p className="text-[10px] text-red-400 mt-1">Setup failed — check console</p>
      )}
    </div>
  );
}
