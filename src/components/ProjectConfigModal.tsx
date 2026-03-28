import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Terminal, Variable, Command, Sparkles, ChevronDown, Type } from 'lucide-react';
import type { CopilotConfig } from '../lib/api';

const DEFAULT_ARGS = ['--yolo', '--allow-all', '--agent', 'squad'];
const DEFAULT_FONT_FAMILY = "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";
const DEFAULT_FONT_SIZE = 13;

const FONT_PRESETS = [
  { label: 'Default (Cascadia Code)', value: '' },
  { label: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { label: 'FiraCode Nerd Font', value: "'FiraCode Nerd Font', 'Fira Code', monospace" },
  { label: 'JetBrainsMono Nerd Font', value: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace" },
  { label: 'Hack Nerd Font', value: "'Hack Nerd Font', 'Hack', monospace" },
  { label: 'MesloLGS Nerd Font', value: "'MesloLGS Nerd Font', 'MesloLGS NF', monospace" },
  { label: 'CaskaydiaCove Nerd Font', value: "'CaskaydiaCove Nerd Font', 'CaskaydiaCove NF', monospace" },
  { label: 'Consolas', value: "'Consolas', monospace" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Custom...', value: 'custom' },
];

interface ShellInfo {
  id: string;
  name: string;
  path: string;
}

interface Props {
  config: CopilotConfig;
  onSave: (config: CopilotConfig) => void;
  onClose: () => void;
}

export default function ProjectConfigModal({ config, onSave, onClose }: Props) {
  const [startCopilot, setStartCopilot] = useState(config.startCopilot !== false);
  const [args, setArgs] = useState<string[]>(config.args.length ? config.args : DEFAULT_ARGS);
  const [envVars, setEnvVars] = useState<[string, string][]>(
    Object.entries(config.envVars || {}).length ? Object.entries(config.envVars) : []
  );
  const [preCommands, setPreCommands] = useState<string[]>(config.preCommands || []);
  const [selectedShell, setSelectedShell] = useState(config.shell || '');
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
  const [fontPreset, setFontPreset] = useState(() => {
    const saved = config.terminalFontFamily || '';
    const match = FONT_PRESETS.find(p => p.value === saved);
    return match ? saved : (saved ? 'custom' : '');
  });
  const [customFont, setCustomFont] = useState(() => {
    const saved = config.terminalFontFamily || '';
    const match = FONT_PRESETS.find(p => p.value === saved);
    return match ? '' : saved;
  });
  const [termFontSize, setTermFontSize] = useState(config.terminalFontSize || DEFAULT_FONT_SIZE);
  const [newArg, setNewArg] = useState('');
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newCmd, setNewCmd] = useState('');

  useEffect(() => {
    window.electronAPI.invoke('filesystem:availableShells').then((shells: ShellInfo[]) => {
      setAvailableShells(shells);
    });
  }, []);

  function handleSave() {
    const resolvedFont = fontPreset === 'custom' ? customFont : fontPreset;
    onSave({
      args,
      envVars: Object.fromEntries(envVars),
      preCommands,
      startCopilot,
      shell: selectedShell || undefined,
      terminalFontFamily: resolvedFont || undefined,
      terminalFontSize: termFontSize !== DEFAULT_FONT_SIZE ? termFontSize : undefined,
    });
  }

  function handleResetArgs() {
    setArgs([...DEFAULT_ARGS]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-slate-800 ring-1 ring-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Session Configuration</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Start Copilot toggle */}
          <section>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {startCopilot ? (
                  <Sparkles className="w-4 h-4 text-violet-400" />
                ) : (
                  <Terminal className="w-4 h-4 text-slate-400" />
                )}
                <h3 className="text-sm font-semibold text-white">Start Copilot</h3>
              </div>
              <button
                onClick={() => setStartCopilot(!startCopilot)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  startCopilot ? 'bg-violet-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    startCopilot ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {startCopilot ? 'Copilot CLI will start automatically' : 'Shell-only mode — opens a terminal with environment and pre-commands'}
            </p>
          </section>

          {/* Shell selector */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Shell</h3>
            </div>
            <div className="relative">
              <select
                value={selectedShell}
                onChange={e => setSelectedShell(e.target.value)}
                className="w-full appearance-none text-xs bg-slate-900/60 px-3 py-2 rounded-lg ring-1 ring-white/5 text-white font-mono focus:ring-cyan-500/50 focus:outline-none cursor-pointer pr-8"
              >
                <option value="">System default</option>
                {availableShells.map(shell => (
                  <option key={shell.id} value={shell.path}>
                    {shell.name} — {shell.path}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {startCopilot ? 'Shell used for pre-launch commands' : 'Shell to open in terminal'}
            </p>
          </section>

          {/* Terminal Font */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-semibold text-white">Terminal Font</h3>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <select
                  value={fontPreset}
                  onChange={e => setFontPreset(e.target.value)}
                  className="w-full appearance-none text-xs bg-slate-900/60 px-3 py-2 rounded-lg ring-1 ring-white/5 text-white font-mono focus:ring-pink-500/50 focus:outline-none cursor-pointer pr-8"
                >
                  {FONT_PRESETS.map(preset => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
              {fontPreset === 'custom' && (
                <input
                  type="text"
                  value={customFont}
                  onChange={e => setCustomFont(e.target.value)}
                  placeholder="'MyFont Nerd Font', monospace"
                  className="w-full text-xs bg-slate-900/40 px-3 py-2 rounded-lg ring-1 ring-white/5 text-white placeholder-slate-600 font-mono focus:ring-pink-500/50 focus:outline-none"
                />
              )}
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400 whitespace-nowrap">Size</label>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={termFontSize}
                  onChange={e => setTermFontSize(Number(e.target.value))}
                  className="flex-1 accent-pink-500 h-1"
                />
                <span className="text-xs text-white font-mono w-6 text-right">{termFontSize}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Font family and size for the terminal. Install NerdFonts for icon support.
            </p>
          </section>

          {/* Copilot Arguments — only when copilot is enabled */}
          {startCopilot && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Copilot Arguments</h3>
              </div>
              <button onClick={handleResetArgs} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                Reset defaults
              </button>
            </div>
            <div className="space-y-1.5">
              {args.map((arg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-lg ring-1 ring-white/5 font-mono">
                    {arg}
                  </code>
                  <button onClick={() => setArgs(args.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newArg}
                  onChange={e => setNewArg(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newArg.trim()) {
                      setArgs([...args, newArg.trim()]);
                      setNewArg('');
                    }
                  }}
                  placeholder="--flag or value"
                  className="flex-1 text-xs bg-slate-900/40 px-3 py-1.5 rounded-lg ring-1 ring-white/5 text-white placeholder-slate-600 font-mono focus:ring-violet-500/50 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (newArg.trim()) { setArgs([...args, newArg.trim()]); setNewArg(''); }
                  }}
                  className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Command: copilot {args.join(' ')}</p>
          </section>
          )}

          {/* Environment Variables */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Variable className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Environment Variables</h3>
            </div>
            <div className="space-y-1.5">
              {envVars.map(([key, val], i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="text-xs text-emerald-400 bg-slate-900/60 px-2 py-1.5 rounded-lg ring-1 ring-white/5 font-mono w-1/3 truncate">
                    {key}
                  </code>
                  <code className="flex-1 text-xs text-slate-300 bg-slate-900/60 px-2 py-1.5 rounded-lg ring-1 ring-white/5 font-mono truncate">
                    {val}
                  </code>
                  <button onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newEnvKey}
                  onChange={e => setNewEnvKey(e.target.value)}
                  placeholder="KEY"
                  className="w-1/3 text-xs bg-slate-900/40 px-2 py-1.5 rounded-lg ring-1 ring-white/5 text-white placeholder-slate-600 font-mono focus:ring-emerald-500/50 focus:outline-none"
                />
                <input
                  type="text"
                  value={newEnvVal}
                  onChange={e => setNewEnvVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newEnvKey.trim()) {
                      setEnvVars([...envVars, [newEnvKey.trim(), newEnvVal]]);
                      setNewEnvKey('');
                      setNewEnvVal('');
                    }
                  }}
                  placeholder="value"
                  className="flex-1 text-xs bg-slate-900/40 px-2 py-1.5 rounded-lg ring-1 ring-white/5 text-white placeholder-slate-600 font-mono focus:ring-emerald-500/50 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (newEnvKey.trim()) {
                      setEnvVars([...envVars, [newEnvKey.trim(), newEnvVal]]);
                      setNewEnvKey('');
                      setNewEnvVal('');
                    }
                  }}
                  className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Pre-launch Commands */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Command className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Pre-launch Commands</h3>
            </div>
            <p className="text-[10px] text-slate-500 mb-2">Commands to run before starting copilot (e.g. az login, source .env)</p>
            <div className="space-y-1.5">
              {preCommands.map((cmd, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-lg ring-1 ring-white/5 font-mono">
                    {cmd}
                  </code>
                  <button onClick={() => setPreCommands(preCommands.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCmd}
                  onChange={e => setNewCmd(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCmd.trim()) {
                      setPreCommands([...preCommands, newCmd.trim()]);
                      setNewCmd('');
                    }
                  }}
                  placeholder="az login --use-device-code"
                  className="flex-1 text-xs bg-slate-900/40 px-3 py-1.5 rounded-lg ring-1 ring-white/5 text-white placeholder-slate-600 font-mono focus:ring-amber-500/50 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (newCmd.trim()) { setPreCommands([...preCommands, newCmd.trim()]); setNewCmd(''); }
                  }}
                  className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-all"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
