import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import type { Session, SessionMessage } from '../../../shared/types.js';
import { broadcast } from './websocket.js';

const MAX_OUTPUT_LINES = 500;

interface ManagedSession {
  session: Session;
  process: ChildProcess;
  outputBuffer: string[];
  messages: SessionMessage[];
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
    status: 'starting',
    startedAt: new Date().toISOString(),
  };

  const isWindows = process.platform === 'win32';

  const child = spawn('copilot', [], {
    cwd: projectPath,
    shell: isWindows,
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

  addMessage(managed, 'system', `Copilot session started in ${projectPath}`);
  broadcastSessionStatus(session);
  attachProcessHandlers(managed);

  return session;
}

export function stopSession(sessionId: string): Session | null {
  const managed = sessions.get(sessionId);
  if (!managed) return null;

  const { session, process: child } = managed;

  if (session.status === 'active' || session.status === 'starting') {
    try {
      child.kill();
    } catch {
      // Process may have already exited
    }
    session.status = 'stopped';
    addMessage(managed, 'system', 'Session stopped by user');
    broadcastSessionStatus(session);
  }

  return session;
}

export function sendInput(sessionId: string, text: string): boolean {
  const managed = sessions.get(sessionId);
  if (!managed) return false;
  if (managed.session.status !== 'active') return false;

  const { process: child } = managed;
  if (!child.stdin?.writable) return false;

  // Ensure input ends with newline so commands execute
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
