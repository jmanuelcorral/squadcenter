import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import * as pty from 'node-pty';
import type { Session, SessionMessage } from '../../shared/types.js';
import { broadcast } from './event-bridge.js';

const MAX_OUTPUT_LINES = 500;

export interface SessionStats {
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  premiumRequests: number;
  lastUpdated: string;
}

function createEmptyStats(): SessionStats {
  return { tokensIn: 0, tokensOut: 0, tokensTotal: 0, premiumRequests: 0, lastUpdated: '' };
}

interface ManagedSession {
  session: Session;
  process: ChildProcess;
  outputBuffer: string[];
  messages: SessionMessage[];
  pty?: pty.IPty;
  stats: SessionStats;
}

const sessions = new Map<string, ManagedSession>();

function broadcastSessionStatus(session: Session): void {
  broadcast('session:status', {
    sessionId: session.id,
    projectId: session.projectId,
    status: session.status,
    pid: session.pid,
  });
}

function broadcastSessionOutput(sessionId: string, message: SessionMessage): void {
  broadcast('session:output', { sessionId, message });
}

function addMessage(
  managed: ManagedSession,
  type: SessionMessage['type'],
  content: string,
): SessionMessage {
  const msg: SessionMessage = {
    id: crypto.randomUUID(),
    sessionId: managed.session.id,
    type,
    content,
    timestamp: new Date().toISOString(),
  };
  managed.messages.push(msg);
  if (managed.messages.length > MAX_OUTPUT_LINES * 2) {
    managed.messages = managed.messages.slice(-MAX_OUTPUT_LINES);
  }
  return msg;
}

function attachProcessHandlers(managed: ManagedSession): void {
  const { session, process: child } = managed;
  const id = session.id;

  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    const lines = text.split('\n');
    managed.outputBuffer.push(...lines);
    if (managed.outputBuffer.length > MAX_OUTPUT_LINES) {
      managed.outputBuffer = managed.outputBuffer.slice(-MAX_OUTPUT_LINES);
    }
    session.lastOutput = text.trimEnd();
    const msg = addMessage(managed, 'output', text);
    broadcastSessionOutput(id, msg);
  });

  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    managed.outputBuffer.push(...text.split('\n'));
    if (managed.outputBuffer.length > MAX_OUTPUT_LINES) {
      managed.outputBuffer = managed.outputBuffer.slice(-MAX_OUTPUT_LINES);
    }
    session.lastOutput = text.trimEnd();
    const msg = addMessage(managed, 'output', text);
    broadcastSessionOutput(id, msg);
  });

  child.on('exit', (code, signal) => {
    session.status = 'stopped';
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    addMessage(managed, 'system', `Session ended (${reason})`);
    broadcastSessionStatus(session);
  });

  child.on('error', (err) => {
    session.status = 'error';
    session.lastOutput = err.message;
    addMessage(managed, 'system', `Error: ${err.message}`);
    broadcastSessionStatus(session);
  });
}

function findActiveSessionForProject(projectId: string): Session | undefined {
  for (const [, managed] of sessions) {
    if (
      managed.session.projectId === projectId &&
      (managed.session.status === 'active' || managed.session.status === 'starting')
    ) {
      return managed.session;
    }
  }
  return undefined;
}

export function startSession(projectId: string, projectPath: string): Session {
  const existing = findActiveSessionForProject(projectId);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const session: Session = {
    id,
    projectId,
    projectPath,
    type: 'shell',
    status: 'starting',
    startedAt: new Date().toISOString(),
  };

  const isWindows = process.platform === 'win32';
  const shellCmd = isWindows ? 'cmd.exe' : '/bin/bash';
  const shellArgs = isWindows ? ['/K', `cd /d "${projectPath}"`] : [];

  const child = spawn(shellCmd, shellArgs, {
    cwd: projectPath,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    windowsHide: true,
  });

  const managed: ManagedSession = {
    session,
    process: child,
    outputBuffer: [],
    messages: [],
    stats: createEmptyStats(),
  };

  sessions.set(id, managed);

  session.pid = child.pid;
  session.status = 'active';

  addMessage(managed, 'system', `Shell session started in ${projectPath}`);
  broadcastSessionStatus(session);
  attachProcessHandlers(managed);

  return session;
}

export function startCopilotSession(projectId: string, projectPath: string): Session {
  const existing = findActiveSessionForProject(projectId);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const session: Session = {
    id,
    projectId,
    projectPath,
    type: 'copilot',
    status: 'starting',
    startedAt: new Date().toISOString(),
  };

  const ptyProcess = pty.spawn('copilot', ['--yolo', '--agent', 'squad'], {
    name: 'xterm-color',
    cols: 120,
    rows: 30,
    cwd: projectPath,
    env: process.env as Record<string, string>,
  });

  const managed: ManagedSession = {
    session,
    process: null as unknown as ChildProcess,
    outputBuffer: [],
    messages: [],
    pty: ptyProcess,
    stats: createEmptyStats(),
  };

  sessions.set(id, managed);

  let lineBuffer = '';
  ptyProcess.onData((data: string) => {
    broadcast('session:ptyData', { sessionId: id, data });

    // Buffer partial lines and parse complete ones for stats
    lineBuffer += data;
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      parseStatsLine(managed, line, id);
    }
  });

  ptyProcess.onExit(() => {
    session.status = 'stopped';
    session.pid = undefined;
    addMessage(managed, 'system', 'Copilot session ended');
    broadcastSessionStatus(session);
  });

  session.status = 'active';
  session.pid = ptyProcess.pid;

  addMessage(managed, 'system', 'Copilot session started');
  broadcastSessionStatus(session);

  return session;
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const managed = sessions.get(sessionId);
  if (!managed) return;
  if (managed.pty) {
    managed.pty.resize(cols, rows);
  }
}

export function stopSession(sessionId: string): Session | null {
  const managed = sessions.get(sessionId);
  if (!managed) return null;

  const { session } = managed;

  if (session.status === 'active' || session.status === 'starting') {
    if (session.type === 'copilot') {
      if (managed.pty) {
        try {
          managed.pty.kill();
        } catch {
          // PTY may have already exited
        }
      }
    } else {
      try {
        managed.process.kill();
      } catch {
        // Process may have already exited
      }
    }
    session.status = 'stopped';
    session.pid = undefined;
    addMessage(managed, 'system', 'Session stopped by user');
    broadcastSessionStatus(session);
  }

  return session;
}

export function sendInput(sessionId: string, text: string): boolean {
  const managed = sessions.get(sessionId);
  if (!managed) return false;
  if (managed.session.status !== 'active') return false;

  if (managed.session.type === 'copilot') {
    if (!managed.pty) return false;
    managed.pty.write(text);
    return true;
  }

  const { process: child } = managed;
  if (!child.stdin?.writable) return false;

  const input = text.endsWith('\n') ? text : text + '\n';
  child.stdin.write(input);
  addMessage(managed, 'input', text);
  return true;
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId)?.session ?? null;
}

export function getSessionOutput(sessionId: string): string[] {
  return sessions.get(sessionId)?.outputBuffer ?? [];
}

export function getSessionMessages(sessionId: string): SessionMessage[] {
  return sessions.get(sessionId)?.messages ?? [];
}

export function listSessions(): Session[] {
  return Array.from(sessions.values()).map((m) => m.session);
}

export function findSessionByProject(projectId: string): Session | undefined {
  return findActiveSessionForProject(projectId);
}

export function cleanupSessions(): void {
  for (const [id, managed] of sessions) {
    if (managed.session.status === 'stopped' || managed.session.status === 'error') {
      sessions.delete(id);
    }
  }
}

export function getSessionStats(sessionId: string): SessionStats | null {
  return sessions.get(sessionId)?.stats ?? null;
}

// Strip ANSI escape codes for clean text parsing
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)/g;

function parseStatsLine(managed: ManagedSession, line: string, sessionId: string): void {
  const clean = line.replace(ANSI_RE, '').trim();
  if (!clean) return;

  let changed = false;

  // Match "N tokens" or "tokens: N" or "Tokens used: N"
  const tokenMatch = clean.match(/(\d[\d,]*)\s*tokens?\b/i)
    || clean.match(/tokens?\s*(?:used|total|count)?[:\s]+(\d[\d,]*)/i);
  if (tokenMatch) {
    managed.stats.tokensTotal = parseInt(tokenMatch[1].replace(/,/g, ''), 10);
    changed = true;
  }

  // Match "N in, M out" token breakdown (e.g. "Tokens: 1234 in, 5678 out")
  const inOutMatch = clean.match(/(\d[\d,]*)\s*in\b.*?(\d[\d,]*)\s*out\b/i);
  if (inOutMatch) {
    managed.stats.tokensIn = parseInt(inOutMatch[1].replace(/,/g, ''), 10);
    managed.stats.tokensOut = parseInt(inOutMatch[2].replace(/,/g, ''), 10);
    managed.stats.tokensTotal = managed.stats.tokensIn + managed.stats.tokensOut;
    changed = true;
  }

  // Match premium request patterns: "N premium request(s)", "premium requests: N", "N/M premium"
  const premiumMatch = clean.match(/premium\s*request/i);
  if (premiumMatch) {
    const countMatch = clean.match(/(\d[\d,]*)\s*(?:\/\s*\d[\d,]*)?\s*premium/i)
      || clean.match(/premium[^:]*:\s*(\d[\d,]*)/i);
    if (countMatch) {
      managed.stats.premiumRequests = parseInt(countMatch[1].replace(/,/g, ''), 10);
    } else {
      managed.stats.premiumRequests++;
    }
    changed = true;
  }

  // Match "requests this session: N" or "requests used: N" or "requests consumed: N"
  const requestMatch = clean.match(/requests?\s*(?:this\s+session|used|consumed)[:\s]*(\d[\d,]*)/i);
  if (requestMatch) {
    managed.stats.premiumRequests = parseInt(requestMatch[1].replace(/,/g, ''), 10);
    changed = true;
  }

  if (changed) {
    managed.stats.lastUpdated = new Date().toISOString();
    broadcast('session:stats', { sessionId, stats: managed.stats });
  }
}
