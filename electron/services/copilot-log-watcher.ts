import { readdir, readFile, stat, access } from 'fs/promises';
import { watch, type FSWatcher, existsSync } from 'fs';
import path from 'path';
import os from 'os';

export interface CopilotSessionStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
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

export interface MemberActivity {
  name: string;
  status: 'idle' | 'working' | 'done';
  subagents: SubagentSpawn[];
  toolCalls: AgentToolCall[];
  lastActiveAt?: string;
}

export interface AgentActivity {
  isActive: boolean;
  currentTurnStart?: string;
  agentName?: string;
  toolCalls: AgentToolCall[];
  subagents: SubagentSpawn[];
  members: Record<string, MemberActivity>;
  lastUpdated: string;
}

export interface SessionHistoryEntry {
  id: string;
  sessionDir: string;
  startedAt: string;
  stats: CopilotSessionStats;
  agentSummary: { total: number; completed: number; failed: number; running: number };
  members: string[];
}

const LOG_PREFIX = '[copilot-log-watcher]';

async function findAllCopilotSessionDirs(projectPath: string): Promise<{ dir: string; mtime: number; id: string }[]> {
  const sessionStateDir = path.join(os.homedir(), '.copilot', 'session-state');
  try {
    const dirs = await readdir(sessionStateDir, { withFileTypes: true });
    const candidates: { dir: string; mtime: number; id: string }[] = [];
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
            candidates.push({ dir: path.join(sessionStateDir, d.name), mtime: fileStat.mtimeMs, id: d.name });
          }
        }
      } catch { /* skip unreadable dirs */ }
    }
    candidates.sort((a, b) => b.mtime - a.mtime);
    return candidates;
  } catch { return []; }
}

async function findCopilotSessionDir(projectPath: string): Promise<string | null> {
  const candidates = await findAllCopilotSessionDirs(projectPath);
  return candidates[0]?.dir ?? null;
}

async function parseEventsFile(eventsPath: string): Promise<CopilotSessionStats> {
  const stats: CopilotSessionStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
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
            if (event.data?.inputTokens) {
              stats.inputTokens += event.data.inputTokens;
            }
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
    stats.totalTokens = stats.inputTokens + stats.outputTokens;
    stats.lastUpdated = new Date().toISOString();
  } catch { /* file not readable */ }

  return stats;
}

function createEmptyActivity(): AgentActivity {
  return {
    isActive: false,
    toolCalls: [],
    subagents: [],
    members: {},
    lastUpdated: '',
  };
}

function extractMemberName(description: string): string | null {
  if (!description) return null;
  // Strip leading emoji / non-word characters (handles multi-byte unicode)
  const cleaned = description.replace(/^[^\p{L}\p{N}_]+/u, '').trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^(\w+)[\s:]/);
  return match ? match[1] : null;
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
    // Maps background agent_id → original toolCallId for tracking via read_agent
    const bgAgentIdToToolCall = new Map<string, string>();
    // Track which subagents are background (don't mark complete on immediate return)
    const backgroundToolCalls = new Set<string>();
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
              const isBackground = args.mode === 'background';
              const spawn: SubagentSpawn = {
                id: toolCallId,
                name: args.name ?? '',
                description: args.description ?? '',
                agentType: args.agent_type ?? '',
                status: 'running',
                startTime: ts,
              };
              subagentMap.set(toolCallId, spawn);
              if (isBackground) {
                backgroundToolCalls.add(toolCallId);
              }
            }

            // Track read_agent calls — link to the original background subagent
            if (toolName === 'read_agent' && args.agent_id) {
              const originalToolCallId = bgAgentIdToToolCall.get(args.agent_id);
              if (originalToolCallId) {
                // Mark that we're still tracking this agent
                const sub = subagentMap.get(originalToolCallId);
                if (sub && sub.status === 'running') {
                  // Still running — keep it alive
                }
              }
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

            // Check if this is a background task completing with "Agent started in background"
            const isBackgroundLaunch = backgroundToolCalls.has(toolCallId)
              && typeof resultStr === 'string'
              && resultStr.includes('Agent started in background');

            if (isBackgroundLaunch) {
              // Extract agent_id from result: "Agent started in background with agent_id: {id}"
              const agentIdMatch = resultStr.match(/agent_id:\s*(\S+)/);
              if (agentIdMatch) {
                bgAgentIdToToolCall.set(agentIdMatch[1].replace(/[.,]$/, ''), toolCallId);
              }
              // DON'T mark the subagent as completed — it's still running in background
              break;
            }

            // Check if this is a read_agent completion — update the tracked subagent
            const startTc = toolCallMap.get(toolCallId);
            if (startTc?.toolName === 'read_agent') {
              const agentIdArg = startTc.arguments?.agent_id;
              if (agentIdArg) {
                const originalId = bgAgentIdToToolCall.get(agentIdArg);
                if (originalId) {
                  const sub = subagentMap.get(originalId);
                  if (sub) {
                    // Check if the agent has completed
                    const isCompleted = resultStr.includes('status: completed')
                      || resultStr.includes('status: failed')
                      || resultStr.includes('status: cancelled');
                    const isFailed = resultStr.includes('status: failed')
                      || resultStr.includes('status: cancelled');
                    if (isCompleted) {
                      sub.status = isFailed ? 'failed' : 'completed';
                      sub.endTime = ts;
                      sub.result = truncate(resultStr, 500);
                    }
                    // If still running, keep status as 'running'
                  }
                }
              }
              // Update the read_agent tool call itself
              if (startTc) {
                startTc.status = success ? 'completed' : 'failed';
                startTc.endTime = ts;
                startTc.result = resultStr;
                startTc.model = event.data?.model;
              }
              break;
            }

            // Normal (non-background) tool completion
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

    // Group subagents by team member
    const membersMap: Record<string, MemberActivity> = {};
    for (const spawn of activity.subagents) {
      const memberName = extractMemberName(spawn.description) ?? 'Unknown';
      const key = memberName.toLowerCase();
      if (!membersMap[key]) {
        membersMap[key] = {
          name: memberName,
          status: 'idle',
          subagents: [],
          toolCalls: [],
        };
      }
      membersMap[key].subagents.push(spawn);

      // Track most recent timestamp for lastActiveAt
      const latestTs = spawn.endTime ?? spawn.startTime;
      if (latestTs && (!membersMap[key].lastActiveAt || latestTs > membersMap[key].lastActiveAt!)) {
        membersMap[key].lastActiveAt = latestTs;
      }
    }

    // Determine member status
    for (const member of Object.values(membersMap)) {
      const hasRunning = member.subagents.some(s => s.status === 'running');
      if (hasRunning) {
        member.status = 'working';
      } else if (member.subagents.length > 0) {
        member.status = 'done';
      }
      // else stays 'idle' (shouldn't happen since we only create entries from subagents)
    }
    activity.members = membersMap;

    activity.lastUpdated = new Date().toISOString();
  } catch { /* file not readable */ }

  return activity;
}

export function watchCopilotSession(
  projectPath: string,
  onUpdate: (stats: CopilotSessionStats) => void,
  onActivityUpdate?: (activity: AgentActivity) => void,
  startedAfter?: number,
): { stop: () => void } {
  let watcher: FSWatcher | null = null;
  let dirWatcher: FSWatcher | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  // Find session dir created/modified after the managed session started
  const findSessionDir = async (): Promise<string | null> => {
    const candidates = await findAllCopilotSessionDirs(projectPath);
    if (startedAfter) {
      // Only consider dirs modified after session start (with 5s grace)
      const threshold = startedAfter - 5000;
      const fresh = candidates.find(c => c.mtime >= threshold);
      return fresh?.dir ?? null;
    }
    return candidates[0]?.dir ?? null;
  };

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
    }, 1500);
    console.log(LOG_PREFIX, 'Polling events file every 1.5s:', eventsPath);
  };

  const startWatching = async () => {
    console.log(LOG_PREFIX, 'Looking for copilot session dir for:', projectPath);

    // Phase 1: find the session directory — retry up to 2 minutes
    let sessionDir: string | null = null;
    for (let attempt = 0; attempt < 40 && !stopped; attempt++) {
      sessionDir = await findSessionDir();
      if (sessionDir) break;
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!sessionDir || stopped) {
      console.log(LOG_PREFIX, 'Could not find session dir after retries. Falling back to periodic scan.');
      // Keep scanning every 10s indefinitely
      pollInterval = setInterval(async () => {
        if (stopped) return;
        const dir = await findSessionDir();
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
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, premiumRequests: 0, turns: 0, toolCalls: 0, lastUpdated: '' };
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

/** List all copilot session history for a project path */
export async function listSessionHistory(projectPath: string): Promise<SessionHistoryEntry[]> {
  const dirs = await findAllCopilotSessionDirs(projectPath);
  const entries: SessionHistoryEntry[] = [];

  for (const { dir, mtime, id } of dirs) {
    const eventsPath = path.join(dir, 'events.jsonl');
    try {
      const [stats, activity] = await Promise.all([
        parseEventsFile(eventsPath),
        parseAgentActivity(eventsPath),
      ]);

      // Skip empty sessions (no turns at all)
      if (stats.turns === 0 && stats.toolCalls === 0) continue;

      const subagents = activity.subagents ?? [];
      entries.push({
        id,
        sessionDir: dir,
        startedAt: new Date(mtime).toISOString(),
        stats,
        agentSummary: {
          total: subagents.length,
          completed: subagents.filter(s => s.status === 'completed').length,
          failed: subagents.filter(s => s.status === 'failed').length,
          running: subagents.filter(s => s.status === 'running').length,
        },
        members: Object.keys(activity.members),
      });
    } catch { /* skip unreadable sessions */ }
  }

  return entries;
}
