import { readdir, readFile, stat } from 'fs/promises';
import { watch, type FSWatcher } from 'fs';
import path from 'path';
import os from 'os';

export interface CopilotSessionStats {
  outputTokens: number;
  premiumRequests: number;
  turns: number;
  toolCalls: number;
  lastUpdated: string;
}

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
          const cwd = cwdMatch[1].trim();
          if (cwd.toLowerCase() === projectPath.toLowerCase()) {
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

export function watchCopilotSession(
  projectPath: string,
  onUpdate: (stats: CopilotSessionStats) => void,
): { stop: () => void } {
  let watcher: FSWatcher | null = null;
  let sessionDir: string | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const startWatching = async () => {
    for (let attempt = 0; attempt < 10 && !stopped; attempt++) {
      sessionDir = await findCopilotSessionDir(projectPath);
      if (sessionDir) break;
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!sessionDir || stopped) return;

    const eventsPath = path.join(sessionDir, 'events.jsonl');

    const initialStats = await parseEventsFile(eventsPath);
    onUpdate(initialStats);

    try {
      watcher = watch(eventsPath, { persistent: false }, async () => {
        if (stopped) return;
        const stats = await parseEventsFile(eventsPath);
        onUpdate(stats);
      });
    } catch {
      pollInterval = setInterval(async () => {
        if (stopped) return;
        const stats = await parseEventsFile(eventsPath);
        onUpdate(stats);
      }, 5000);
    }
  };

  startWatching();

  return {
    stop: () => {
      stopped = true;
      if (watcher) { watcher.close(); watcher = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    },
  };
}
