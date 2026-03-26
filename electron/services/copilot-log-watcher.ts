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

export function watchCopilotSession(
  projectPath: string,
  onUpdate: (stats: CopilotSessionStats) => void,
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
