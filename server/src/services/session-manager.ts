import { spawn, exec, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import type { Session, SessionMessage } from '../../../shared/types.js';
import { broadcast } from './websocket.js';

const MAX_OUTPUT_LINES = 500;

interface ManagedSession {
  session: Session;
  process: ChildProcess;
  outputBuffer: string[];
  messages: SessionMessage[];
  busy?: boolean;
  currentChild?: ChildProcess;
}

const sessions = new Map<string, ManagedSession>();

function broadcastSessionStatus(session: Session): void {
  broadcast('session:status' as any, {
    sessionId: session.id,
    projectId: session.projectId,
    status: session.status,
    pid: session.pid,
  });
}

function broadcastSessionOutput(sessionId: string, message: SessionMessage): void {
  broadcast('session:output' as any, { sessionId, message });
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
  // Keep messages bounded
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
    status: 'active',
    startedAt: new Date().toISOString(),
    pid: undefined,
  };

  // Copilot sessions are logical — no persistent process.
  // Each prompt spawns a one-shot `copilot -p` child.
  const managed: ManagedSession = {
    session,
    process: null as unknown as ChildProcess,
    outputBuffer: [],
    messages: [],
    busy: false,
  };

  sessions.set(id, managed);

  addMessage(managed, 'system', `Copilot session ready in ${projectPath}`);
  broadcastSessionStatus(session);

  return session;
}

function parseStderrStats(stderr: string): string | null {
  // Extract usage stats like "Tokens: 150 in, 42 out | Requests: 3 Premium"
  const lines = stderr.split('\n').filter((l) => l.trim().length > 0);
  for (const line of lines) {
    if (/request|token|premium/i.test(line)) {
      return line.trim();
    }
  }
  // Fallback: last non-empty line if it looks like stats
  const last = lines[lines.length - 1];
  if (last && last.length < 200) return last.trim();
  return null;
}

function sendCopilotPrompt(managed: ManagedSession, text: string): boolean {
  if (managed.busy) {
    addMessage(managed, 'system', 'Copilot is still processing the previous prompt');
    broadcastSessionOutput(managed.session.id, managed.messages[managed.messages.length - 1]);
    return false;
  }

  managed.busy = true;
  const { session } = managed;
  const projectPath = session.projectPath;

  addMessage(managed, 'input', text);
  broadcastSessionOutput(session.id, managed.messages[managed.messages.length - 1]);

  const thinkingMsg = addMessage(managed, 'system', 'Copilot is thinking...');
  broadcastSessionOutput(session.id, thinkingMsg);

  const escapedText = text.replace(/"/g, '\\"');
  const child = exec(`copilot -p "${escapedText}"`, {
    cwd: projectPath,
    env: { ...process.env },
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });

  managed.currentChild = child;
  session.pid = child.pid;

  let stdoutBuf = '';
  let stderrBuf = '';

  child.stdout?.on('data', (data: Buffer) => {
    stdoutBuf += data.toString();
  });

  child.stderr?.on('data', (data: Buffer) => {
    stderrBuf += data.toString();
  });

  child.on('close', () => {
    const response = stdoutBuf.trim();
    if (response) {
      const outputMsg = addMessage(managed, 'output', response);
      managed.outputBuffer.push(...response.split('\n'));
      if (managed.outputBuffer.length > MAX_OUTPUT_LINES) {
        managed.outputBuffer = managed.outputBuffer.slice(-MAX_OUTPUT_LINES);
      }
      session.lastOutput = response;
      broadcastSessionOutput(session.id, outputMsg);
    }

    const stats = parseStderrStats(stderrBuf);
    if (stats) {
      const statsMsg = addMessage(managed, 'system', stats);
      broadcastSessionOutput(session.id, statsMsg);
    }

    managed.busy = false;
    managed.currentChild = undefined;
    session.pid = undefined;
  });

  child.on('error', (err) => {
    const errMsg = addMessage(managed, 'system', `Copilot error: ${err.message}`);
    broadcastSessionOutput(session.id, errMsg);
    managed.busy = false;
    managed.currentChild = undefined;
    session.pid = undefined;
  });

  return true;
}

export function stopSession(sessionId: string): Session | null {
  const managed = sessions.get(sessionId);
  if (!managed) return null;

  const { session } = managed;

  if (session.status === 'active' || session.status === 'starting') {
    if (session.type === 'copilot') {
      // Kill the in-flight copilot -p child if one is running
      if (managed.currentChild) {
        try {
          managed.currentChild.kill();
        } catch {
          // Child may have already exited
        }
        managed.currentChild = undefined;
        managed.busy = false;
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
    return sendCopilotPrompt(managed, text);
  }

  // Shell session: write to stdin
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
