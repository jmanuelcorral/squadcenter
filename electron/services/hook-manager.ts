import fs from 'fs/promises';
import path from 'path';
import { broadcast } from './event-bridge.js';
import { loadNotifications, saveNotifications, loadProjects } from './storage.js';
import type { Notification } from '../../shared/types.js';
import crypto from 'crypto';

const LOG = '[hook-manager]';

// ── Signal file paths ──────────────────────────────────────────
function signalsDir(projectPath: string): string {
  return path.join(projectPath, '.copilot', 'hooks', 'signals');
}

function hooksDir(projectPath: string): string {
  return path.join(projectPath, '.copilot', 'hooks');
}

// ── Hook scripts content ───────────────────────────────────────

const SESSION_END_PS1 = `
$ErrorActionPreference = "SilentlyContinue"
$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json
$sigDir = Join-Path $data.cwd ".copilot" "hooks" "signals"
if (-not (Test-Path $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }
$signal = @{
  type      = "session-end"
  reason    = $data.reason
  timestamp = $data.timestamp
  cwd       = $data.cwd
} | ConvertTo-Json -Compress
$signal | Out-File -FilePath (Join-Path $sigDir "session-end.json") -Encoding utf8 -Force
exit 0
`.trim();

const SESSION_END_SH = `#!/bin/bash
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
SIG_DIR="$CWD/.copilot/hooks/signals"
mkdir -p "$SIG_DIR"
REASON=$(echo "$INPUT" | jq -r '.reason')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp')
echo "{\\"type\\":\\"session-end\\",\\"reason\\":\\"$REASON\\",\\"timestamp\\":$TIMESTAMP}" > "$SIG_DIR/session-end.json"
`.trim();

const POST_TOOL_PS1 = `
$ErrorActionPreference = "SilentlyContinue"
$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json
$sigDir = Join-Path $data.cwd ".copilot" "hooks" "signals"
if (-not (Test-Path $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }
$signal = @{
  type       = "tool-activity"
  toolName   = $data.toolName
  resultType = $data.toolResult.resultType
  timestamp  = $data.timestamp
} | ConvertTo-Json -Compress
$signal | Out-File -FilePath (Join-Path $sigDir "last-activity.json") -Encoding utf8 -Force
exit 0
`.trim();

const POST_TOOL_SH = `#!/bin/bash
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
SIG_DIR="$CWD/.copilot/hooks/signals"
mkdir -p "$SIG_DIR"
TOOL=$(echo "$INPUT" | jq -r '.toolName')
RESULT=$(echo "$INPUT" | jq -r '.toolResult.resultType')
TS=$(echo "$INPUT" | jq -r '.timestamp')
echo "{\\"type\\":\\"tool-activity\\",\\"toolName\\":\\"$TOOL\\",\\"resultType\\":\\"$RESULT\\",\\"timestamp\\":$TS}" > "$SIG_DIR/last-activity.json"
`.trim();

const SESSION_START_PS1 = `
$ErrorActionPreference = "SilentlyContinue"
$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json
$sigDir = Join-Path $data.cwd ".copilot" "hooks" "signals"
if (-not (Test-Path $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }
$signal = @{
  type      = "session-start"
  source    = $data.source
  timestamp = $data.timestamp
  cwd       = $data.cwd
} | ConvertTo-Json -Compress
$signal | Out-File -FilePath (Join-Path $sigDir "session-start.json") -Encoding utf8 -Force
exit 0
`.trim();

const SESSION_START_SH = `#!/bin/bash
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd')
SIG_DIR="$CWD/.copilot/hooks/signals"
mkdir -p "$SIG_DIR"
SOURCE=$(echo "$INPUT" | jq -r '.source')
TS=$(echo "$INPUT" | jq -r '.timestamp')
echo "{\\"type\\":\\"session-start\\",\\"source\\":\\"$SOURCE\\",\\"timestamp\\":$TS}" > "$SIG_DIR/session-start.json"
`.trim();

// ── Hooks JSON config ──────────────────────────────────────────

interface HooksConfig {
  version: number;
  hooks: {
    sessionStart?: HookEntry[];
    sessionEnd?: HookEntry[];
    postToolUse?: HookEntry[];
    [key: string]: HookEntry[] | undefined;
  };
}

interface HookEntry {
  type: string;
  bash?: string;
  powershell?: string;
  cwd?: string;
  timeoutSec?: number;
  comment?: string;
}

const SQUAD_COMMENT = 'squad-center-managed';

function createSquadHooksConfig(): HooksConfig {
  return {
    version: 1,
    hooks: {
      sessionStart: [
        {
          type: 'command',
          bash: '.copilot/hooks/session-start.sh',
          powershell: '.copilot/hooks/session-start.ps1',
          timeoutSec: 10,
          comment: SQUAD_COMMENT,
        },
      ],
      sessionEnd: [
        {
          type: 'command',
          bash: '.copilot/hooks/session-end.sh',
          powershell: '.copilot/hooks/session-end.ps1',
          timeoutSec: 10,
          comment: SQUAD_COMMENT,
        },
      ],
      postToolUse: [
        {
          type: 'command',
          bash: '.copilot/hooks/post-tool.sh',
          powershell: '.copilot/hooks/post-tool.ps1',
          timeoutSec: 5,
          comment: SQUAD_COMMENT,
        },
      ],
    },
  };
}

// ── Setup hooks for a project ──────────────────────────────────

export async function setupProjectHooks(projectPath: string): Promise<void> {
  const copilotDir = path.join(projectPath, '.copilot');
  const hooksPath = hooksDir(projectPath);
  const sigDir = signalsDir(projectPath);

  // Ensure directories exist
  await fs.mkdir(hooksPath, { recursive: true });
  await fs.mkdir(sigDir, { recursive: true });

  // Write hook scripts
  await Promise.all([
    fs.writeFile(path.join(hooksPath, 'session-end.ps1'), SESSION_END_PS1, 'utf-8'),
    fs.writeFile(path.join(hooksPath, 'session-end.sh'), SESSION_END_SH, { encoding: 'utf-8', mode: 0o755 }),
    fs.writeFile(path.join(hooksPath, 'post-tool.ps1'), POST_TOOL_PS1, 'utf-8'),
    fs.writeFile(path.join(hooksPath, 'post-tool.sh'), POST_TOOL_SH, { encoding: 'utf-8', mode: 0o755 }),
    fs.writeFile(path.join(hooksPath, 'session-start.ps1'), SESSION_START_PS1, 'utf-8'),
    fs.writeFile(path.join(hooksPath, 'session-start.sh'), SESSION_START_SH, { encoding: 'utf-8', mode: 0o755 }),
  ]);

  // Merge hooks.json (preserve user hooks)
  const hooksJsonPath = path.join(copilotDir, 'hooks.json');
  let config: HooksConfig;

  try {
    const existing = JSON.parse(await fs.readFile(hooksJsonPath, 'utf-8')) as HooksConfig;
    config = mergeHooksConfig(existing);
  } catch {
    config = createSquadHooksConfig();
  }

  await fs.writeFile(hooksJsonPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(LOG, 'Hooks configured for', projectPath);
}

function mergeHooksConfig(existing: HooksConfig): HooksConfig {
  const squadConfig = createSquadHooksConfig();

  for (const [hookType, squadEntries] of Object.entries(squadConfig.hooks)) {
    if (!squadEntries) continue;
    const existingEntries = existing.hooks[hookType] ?? [];

    // Remove old squad-managed entries
    const filtered = existingEntries.filter(
      (e) => (e as HookEntry & { comment?: string }).comment !== SQUAD_COMMENT
    );

    // Add fresh squad entries
    existing.hooks[hookType] = [...filtered, ...squadEntries];
  }

  return existing;
}

// ── Clean up signal files ──────────────────────────────────────

// ── Validate hooks configuration ───────────────────────────────

export interface HooksValidation {
  configured: boolean;
  hasHooksJson: boolean;
  hasSessionEnd: boolean;
  hasPostToolUse: boolean;
  hasSessionStart: boolean;
  hasScripts: boolean;
  missing: string[];
}

const REQUIRED_HOOKS: Array<{ type: keyof HooksConfig['hooks']; label: string }> = [
  { type: 'sessionEnd', label: 'sessionEnd' },
  { type: 'postToolUse', label: 'postToolUse' },
  { type: 'sessionStart', label: 'sessionStart' },
];

const REQUIRED_SCRIPTS = [
  'session-end.ps1', 'session-end.sh',
  'post-tool.ps1', 'post-tool.sh',
  'session-start.ps1', 'session-start.sh',
];

export async function validateProjectHooks(projectPath: string): Promise<HooksValidation> {
  const result: HooksValidation = {
    configured: false,
    hasHooksJson: false,
    hasSessionEnd: false,
    hasPostToolUse: false,
    hasSessionStart: false,
    hasScripts: false,
    missing: [],
  };

  // 1. Check hooks.json exists and is valid JSON
  const hooksJsonPath = path.join(projectPath, '.copilot', 'hooks.json');
  let config: HooksConfig | null = null;
  try {
    config = JSON.parse(await fs.readFile(hooksJsonPath, 'utf-8')) as HooksConfig;
    result.hasHooksJson = true;
  } catch {
    result.missing.push('hooks.json');
    return result;
  }

  // 2. Check each required hook type has a squad-center-managed entry
  for (const { type, label } of REQUIRED_HOOKS) {
    const entries = config.hooks[type] ?? [];
    const hasSquadEntry = entries.some(
      (e) => (e as HookEntry & { comment?: string }).comment === SQUAD_COMMENT
    );
    if (type === 'sessionEnd') result.hasSessionEnd = hasSquadEntry;
    if (type === 'postToolUse') result.hasPostToolUse = hasSquadEntry;
    if (type === 'sessionStart') result.hasSessionStart = hasSquadEntry;
    if (!hasSquadEntry) result.missing.push(`hook: ${label}`);
  }

  // 3. Check scripts exist on disk
  const hooksPath = hooksDir(projectPath);
  let allScriptsExist = true;
  for (const script of REQUIRED_SCRIPTS) {
    try {
      await fs.access(path.join(hooksPath, script));
    } catch {
      allScriptsExist = false;
      result.missing.push(`script: ${script}`);
    }
  }
  result.hasScripts = allScriptsExist;

  // Fully configured only if ALL checks pass
  result.configured =
    result.hasHooksJson &&
    result.hasSessionEnd &&
    result.hasPostToolUse &&
    result.hasSessionStart &&
    result.hasScripts;

  return result;
}

export async function cleanupSignals(projectPath: string): Promise<void> {
  const sigDir = signalsDir(projectPath);
  try {
    const files = await fs.readdir(sigDir);
    await Promise.all(files.map((f) => fs.unlink(path.join(sigDir, f)).catch(() => {})));
  } catch {
    // Directory doesn't exist, nothing to clean
  }
}

// ── Signal Watcher ─────────────────────────────────────────────

interface HookSignalCallbacks {
  onSessionEnd: (reason: string) => void;
  onIdle: () => void;
  onToolActivity: (toolName: string, resultType: string) => void;
}

interface SignalWatcherState {
  lastActivityTimestamp: number;
  wasActive: boolean;
  idleNotified: boolean;
}

export function watchHookSignals(
  projectPath: string,
  sessionId: string,
  callbacks: HookSignalCallbacks,
): { stop: () => void } {
  const sigDir = signalsDir(projectPath);
  let stopped = false;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const state: SignalWatcherState = {
    lastActivityTimestamp: 0,
    wasActive: false,
    idleNotified: false,
  };

  const IDLE_THRESHOLD_MS = 15_000; // 15 seconds of no tool activity → idle

  const checkSignals = async () => {
    if (stopped) return;

    try {
      // Check session-end signal
      const endFile = path.join(sigDir, 'session-end.json');
      try {
        const data = JSON.parse(await fs.readFile(endFile, 'utf-8'));
        console.log(LOG, 'Session end signal detected:', data.reason);
        callbacks.onSessionEnd(data.reason ?? 'unknown');
        await fs.unlink(endFile).catch(() => {});
      } catch {
        // File doesn't exist yet — normal
      }

      // Check tool activity signal
      const activityFile = path.join(sigDir, 'last-activity.json');
      try {
        const stat = await fs.stat(activityFile);
        const data = JSON.parse(await fs.readFile(activityFile, 'utf-8'));
        const ts = data.timestamp ?? stat.mtimeMs;

        if (ts > state.lastActivityTimestamp) {
          state.lastActivityTimestamp = ts;
          state.wasActive = true;
          state.idleNotified = false;
          callbacks.onToolActivity(data.toolName, data.resultType);
        }
      } catch {
        // File doesn't exist yet — normal
      }

      // Idle detection
      if (state.wasActive && !state.idleNotified) {
        const elapsed = Date.now() - state.lastActivityTimestamp;
        if (elapsed >= IDLE_THRESHOLD_MS) {
          console.log(LOG, 'Copilot idle detected after', elapsed, 'ms');
          state.idleNotified = true;
          callbacks.onIdle();
        }
      }
    } catch (err) {
      console.error(LOG, 'Error checking hook signals:', err);
    }
  };

  // Poll every 2 seconds
  pollInterval = setInterval(checkSignals, 2000);
  console.log(LOG, 'Watching hook signals for', projectPath);

  return {
    stop: () => {
      stopped = true;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      console.log(LOG, 'Stopped watching hook signals');
    },
  };
}

// ── High-level: start hook monitoring for a session ────────────

export interface HookMonitor {
  stop: () => void;
}

export async function startHookMonitoring(
  projectPath: string,
  sessionId: string,
  projectId: string,
): Promise<HookMonitor> {
  // Clean up old signals from previous sessions
  await cleanupSignals(projectPath);

  // Set up hooks config and scripts
  await setupProjectHooks(projectPath);

  // Start watching for signals
  const watcher = watchHookSignals(projectPath, sessionId, {
    onSessionEnd: async (reason) => {
      try {
        const projects = await loadProjects();
        const project = projects.find((p) => p.id === projectId);
        const projectName = project?.name ?? projectPath.split(/[\\/]/).pop() ?? 'Unknown';

        const reasonLabel =
          reason === 'complete' ? 'completada' :
          reason === 'error' ? 'con error' :
          reason === 'abort' ? 'abortada' :
          reason === 'timeout' ? 'timeout' :
          reason === 'user_exit' ? 'cerrada por usuario' : reason;

        const notification: Notification = {
          id: crypto.randomUUID(),
          projectId,
          sessionId,
          agentName: 'Copilot Hook',
          message: `🏁 Sesión ${reasonLabel} — "${projectName}"`,
          type: reason === 'complete' ? 'success' : reason === 'error' ? 'error' : 'info',
          read: false,
          createdAt: new Date().toISOString(),
        };

        const existing = await loadNotifications();
        existing.unshift(notification);
        await saveNotifications(existing);
        broadcast('notification', notification);
        broadcast('hook:event', { sessionId, type: 'session-end', reason });
        console.log(LOG, 'Session end notification sent:', reasonLabel, projectName);
      } catch (err) {
        console.error(LOG, 'Failed to create session-end notification:', err);
      }
    },

    onIdle: async () => {
      try {
        const projects = await loadProjects();
        const project = projects.find((p) => p.id === projectId);
        const projectName = project?.name ?? projectPath.split(/[\\/]/).pop() ?? 'Unknown';

        const notification: Notification = {
          id: crypto.randomUUID(),
          projectId,
          sessionId,
          agentName: 'Copilot Hook',
          message: `⏸️ Copilot está esperando input — "${projectName}"`,
          type: 'info',
          read: false,
          createdAt: new Date().toISOString(),
        };

        const existing = await loadNotifications();
        existing.unshift(notification);
        await saveNotifications(existing);
        broadcast('notification', notification);
        broadcast('hook:event', { sessionId, type: 'copilot-idle' });
        console.log(LOG, 'Idle notification sent for', projectName);
      } catch (err) {
        console.error(LOG, 'Failed to create idle notification:', err);
      }
    },

    onToolActivity: (toolName, resultType) => {
      broadcast('hook:event', {
        sessionId,
        type: 'tool-activity',
        toolName,
        resultType,
        timestamp: Date.now(),
      });
    },
  });

  return watcher;
}
