import { readdir, readFile, stat, access } from 'fs/promises';
import { watch, type FSWatcher, existsSync } from 'fs';
import path from 'path';
import os from 'os';

export interface CopilotSessionStats {
  outputTokens: number;
  premiumRequests: number;
  turns: number;
  toolCalls: number;
  lastUpdated: string;
}

export interface AgentToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: string;
  model?: string;
}

export interface SubagentSpawn {
  id: string;
  name: string;
  description: string;
  agentType: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: string;
}

export interface AgentActivity {
  isActive: boolean;
  currentTurnStart?: string;
  agentName?: string;
  toolCalls: AgentToolCall[];
  subagents: SubagentSpawn[];
  lastUpdated: string;
}

const LOG_PREFIX = '[copilot-log-watcher]';

async function findCopilotSessionDir(projectPath: string): Promise<string | null> {
  const sessionStateDir = path.join(os.homedir(), '.copilot', 'session-state');
  try {
    const dirs = await readdir(sessionStateDir, { withFileTypes: true });
    const candidates: { dir: string; mtime: number }[] = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const wsPath = path.join(sessionStateDir, d.name, 'workspace.yaml');
      try {
        const content = await readFile(wsPath, 'utf-8');
        const cwdMatch = content.match(/^cwd:\s*(.+)$/m);
        if (cwdMatch) {
          const cwd = cwdMatch[1].trim().replace(/[\\/]+$/, '');
          const normalizedProject = projectPath.replace(/[\\/]+$/, '');
          if (cwd.toLowerCase() === normalizedProject.toLowerCase()) {
            const fileStat = await stat(wsPath);
            candidates.push({ dir: path.join(sessionStateDir, d.name), mtime: fileStat.mtimeMs });
          }
        }
      } catch { /* skip unreadable dirs */ }
    }
    candidates.sort((a, b) => b.mtime - a.mtime);
    return candidates[0]?.dir ?? null;
  } catch { return null; }
}

async function parseEventsFile(eventsPath: string): Promise<CopilotSessionStats> {
  const stats: CopilotSessionStats = {
    outputTokens: 0,
    premiumRequests: 0,
    turns: 0,
    toolCalls: 0,
    lastUpdated: '',
  };

  try {
    await access(eventsPath);
  } catch {
    return stats; // file doesn't exist yet
  }

  try {
    const content = await readFile(eventsPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        switch (event.type) {
          case 'assistant.message':
            if (event.data?.outputTokens) {
              stats.outputTokens += event.data.outputTokens;
            }
            if (event.data?.toolRequests) {
              stats.toolCalls += event.data.toolRequests.length;
            }
            break;
          case 'assistant.turn_end':
            stats.turns++;
            stats.premiumRequests++;
            break;
        }
      } catch { /* skip malformed lines */ }
    }
    stats.lastUpdated = new Date().toISOString();
  } catch { /* file not readable */ }

  return stats;
}

function createEmptyActivity(): AgentActivity {
  return {
    isActive: false,
    toolCalls: [],
    subagents: [],
    lastUpdated: '',
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export async function parseAgentActivity(eventsPath: string): Promise<AgentActivity> {
  const activity = createEmptyActivity();

  try {
    await access(eventsPath);
  } catch {
    return activity;
  }

  try {
    const content = await readFile(eventsPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const toolCallMap = new Map<string, AgentToolCall>();
    const subagentMap = new Map<string, SubagentSpawn>();
    const activeTurns = new Set<string>();
    let lastTurnStart: string | undefined;
    let agentName: string | undefined;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const ts = event.timestamp ?? new Date().toISOString();

        switch (event.type) {
          case 'assistant.turn_start': {
            const turnId = event.data?.turnId;
            if (turnId) activeTurns.add(turnId);
            lastTurnStart = ts;
            break;
          }
          case 'assistant.turn_end': {
            const turnId = event.data?.turnId;
            if (turnId) activeTurns.delete(turnId);
            break;
          }
          case 'subagent.selected': {
            agentName = event.data?.agentDisplayName ?? event.data?.agentName;
            break;
          }
          case 'tool.execution_start': {
            const toolCallId = event.data?.toolCallId;
            const toolName = event.data?.toolName ?? '';
            const args = event.data?.arguments ?? {};
            if (!toolCallId) break;

            const tc: AgentToolCall = {
              id: toolCallId,
              toolName,
              arguments: args,
              status: 'running',
              startTime: ts,
            };
            toolCallMap.set(toolCallId, tc);

            if (toolName === 'task') {
              const spawn: SubagentSpawn = {
                id: toolCallId,
                name: args.name ?? '',
                description: args.description ?? '',
                agentType: args.agent_type ?? '',
                status: 'running',
                startTime: ts,
              };
              subagentMap.set(toolCallId, spawn);
            }
            break;
          }
          case 'tool.execution_complete': {
            const toolCallId = event.data?.toolCallId;
            if (!toolCallId) break;

            const success = event.data?.success !== false;
            const resultContent = event.data?.result?.content ?? event.data?.result?.detailedContent ?? '';
            const resultStr = typeof resultContent === 'string'
              ? truncate(resultContent, 500)
              : truncate(JSON.stringify(resultContent), 500);

            const existing = toolCallMap.get(toolCallId);
            if (existing) {
              existing.status = success ? 'completed' : 'failed';
              existing.endTime = ts;
              existing.result = resultStr;
              existing.model = event.data?.model;
            }

            const sub = subagentMap.get(toolCallId);
            if (sub) {
              sub.status = success ? 'completed' : 'failed';
              sub.endTime = ts;
              sub.result = resultStr;
            }
            break;
          }
        }
      } catch { /* skip malformed lines */ }
    }

    activity.isActive = activeTurns.size > 0;
    if (activity.isActive) {
      activity.currentTurnStart = lastTurnStart;
    }
    activity.agentName = agentName;
    activity.toolCalls = Array.from(toolCallMap.values()).reverse();
    activity.subagents = Array.from(subagentMap.values()).reverse();
    activity.lastUpdated = new Date().toISOString();
  } catch { /* file not readable */ }

  return activity;
}

export function watchCopilotSession(
  projectPath: string,
  onUpdate: (stats: CopilotSessionStats) => void,
  onActivityUpdate?: (activity: AgentActivity) => void,
): { stop: () => void } {
  let watcher: FSWatcher | null = null;
  let dirWatcher: FSWatcher | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const watchEventsFile = (eventsPath: string) => {
    // Always use polling — fs.watch is unreliable on Windows for appended files
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (stopped) return;
      const stats = await parseEventsFile(eventsPath);
      onUpdate(stats);
      if (onActivityUpdate) {
        const activity = await parseAgentActivity(eventsPath);
        onActivityUpdate(activity);
      }
    }, 3000);
    console.log(LOG_PREFIX, 'Polling events file every 3s:', eventsPath);
  };

  const startWatching = async () => {
    console.log(LOG_PREFIX, 'Looking for copilot session dir for:', projectPath);

    // Phase 1: find the session directory — retry up to 2 minutes
    let sessionDir: string | null = null;
    for (let attempt = 0; attempt < 40 && !stopped; attempt++) {
      sessionDir = await findCopilotSessionDir(projectPath);
      if (sessionDir) break;
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!sessionDir || stopped) {
      console.log(LOG_PREFIX, 'Could not find session dir after retries. Falling back to periodic scan.');
      // Keep scanning every 10s indefinitely
      pollInterval = setInterval(async () => {
        if (stopped) return;
        const dir = await findCopilotSessionDir(projectPath);
        if (dir) {
          console.log(LOG_PREFIX, 'Late-found session dir:', dir);
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
          const eventsPath = path.join(dir, 'events.jsonl');
          const initialStats = await parseEventsFile(eventsPath);
          onUpdate(initialStats);
          if (onActivityUpdate) {
            const activity = await parseAgentActivity(eventsPath);
            onActivityUpdate(activity);
          }
          watchEventsFile(eventsPath);
        }
      }, 10000);
      return;
    }

    console.log(LOG_PREFIX, 'Found session dir:', sessionDir);
    const eventsPath = path.join(sessionDir, 'events.jsonl');

    // Phase 2: read initial stats and start watching
    const initialStats = await parseEventsFile(eventsPath);
    onUpdate(initialStats);
    if (onActivityUpdate) {
      const initialActivity = await parseAgentActivity(eventsPath);
      onActivityUpdate(initialActivity);
    }

    // If events.jsonl doesn't exist yet, watch the directory for it to appear
    if (!existsSync(eventsPath)) {
      console.log(LOG_PREFIX, 'events.jsonl not found yet, watching directory...');
      try {
        dirWatcher = watch(sessionDir, { persistent: false }, (eventType, filename) => {
          if (stopped) return;
          if (filename === 'events.jsonl') {
            console.log(LOG_PREFIX, 'events.jsonl appeared!');
            if (dirWatcher) { dirWatcher.close(); dirWatcher = null; }
            parseEventsFile(eventsPath).then(s => onUpdate(s));
            if (onActivityUpdate) {
              parseAgentActivity(eventsPath).then(a => onActivityUpdate(a));
            }
            watchEventsFile(eventsPath);
          }
        });
      } catch {
        // Fallback: poll for file existence
        watchEventsFile(eventsPath);
      }
    } else {
      watchEventsFile(eventsPath);
    }
  };

  startWatching();

  return {
    stop: () => {
      stopped = true;
      if (watcher) { watcher.close(); watcher = null; }
      if (dirWatcher) { dirWatcher.close(); dirWatcher = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    },
  };
}

/** One-shot refresh: find session dir, parse events, return stats */
export async function forceRefreshStats(projectPath: string): Promise<CopilotSessionStats> {
  console.log(LOG_PREFIX, 'Force refresh for:', projectPath);
  const sessionDir = await findCopilotSessionDir(projectPath);
  if (!sessionDir) {
    console.log(LOG_PREFIX, 'Force refresh: no session dir found');
    return { outputTokens: 0, premiumRequests: 0, turns: 0, toolCalls: 0, lastUpdated: '' };
  }
  console.log(LOG_PREFIX, 'Force refresh: found dir', sessionDir);
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  return parseEventsFile(eventsPath);
}

/** One-shot refresh: find session dir, parse events, return agent activity */
export async function forceRefreshActivity(projectPath: string): Promise<AgentActivity> {
  console.log(LOG_PREFIX, 'Force refresh activity for:', projectPath);
  const sessionDir = await findCopilotSessionDir(projectPath);
  if (!sessionDir) {
    console.log(LOG_PREFIX, 'Force refresh activity: no session dir found');
    return createEmptyActivity();
  }
  console.log(LOG_PREFIX, 'Force refresh activity: found dir', sessionDir);
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  return parseAgentActivity(eventsPath);
}
