import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import * as pty from 'node-pty';
import type { Session, SessionMessage } from '../../shared/types.js';
import { broadcast } from './event-bridge.js';
import { detectAzureAccount, detectMcpServers, type AzureAccount, type McpServer } from './environment-info.js';
import { watchCopilotSession, forceRefreshStats, forceRefreshActivity, type CopilotSessionStats, type AgentActivity } from './copilot-log-watcher.js';

const MAX_OUTPUT_LINES = 500;

export interface SessionStats {
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  premiumRequests: number;
  turns: number;
  toolCalls: number;
  lastUpdated: string;
}

function createEmptyStats(): SessionStats {
  return { tokensIn: 0, tokensOut: 0, tokensTotal: 0, premiumRequests: 0, turns: 0, toolCalls: 0, lastUpdated: '' };
}

interface ManagedSession {
  session: Session;
  process: ChildProcess;
  outputBuffer: string[];
  messages: SessionMessage[];
  pty?: pty.IPty;
  stats: SessionStats;
  azureAccount?: AzureAccount | null;
  mcpServers?: McpServer[];
  logWatcher?: { stop: () => void };
  agentActivity?: AgentActivity;
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

export async function startCopilotSession(projectId: string, projectPath: string): Promise<Session> {
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

  // Detect Azure account and MCP servers BEFORE starting copilot
  const [azureAccount, mcpServers] = await Promise.all([
    detectAzureAccount().catch(() => null),
    detectMcpServers(projectPath).catch(() => []),
  ]);

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
    azureAccount,
    mcpServers,
  };

  sessions.set(id, managed);

  ptyProcess.onData((data: string) => {
    broadcast('session:ptyData', { sessionId: id, data });
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

  // Start watching copilot session logs for real stats
  const logWatcher = watchCopilotSession(
    projectPath,
    (copilotStats) => {
      managed.stats = {
        tokensIn: 0,
        tokensOut: copilotStats.outputTokens,
        tokensTotal: copilotStats.outputTokens,
        premiumRequests: copilotStats.premiumRequests,
        turns: copilotStats.turns,
        toolCalls: copilotStats.toolCalls,
        lastUpdated: copilotStats.lastUpdated,
      };
      broadcast('session:stats', { sessionId: id, stats: managed.stats });
    },
    (activity) => {
      managed.agentActivity = activity;
      broadcast('session:agentActivity', { sessionId: id, activity });
    },
  );
  managed.logWatcher = logWatcher;

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
      if (managed.logWatcher) {
        managed.logWatcher.stop();
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
      if (managed.logWatcher) {
        managed.logWatcher.stop();
      }
      sessions.delete(id);
    }
  }
}

export function getSessionStats(sessionId: string): SessionStats | null {
  return sessions.get(sessionId)?.stats ?? null;
}

export async function refreshSessionStats(sessionId: string): Promise<SessionStats | null> {
  const managed = sessions.get(sessionId);
  if (!managed) return null;
  const projectPath = managed.session.projectPath;
  const copilotStats = await forceRefreshStats(projectPath);
  managed.stats = {
    tokensIn: 0,
    tokensOut: copilotStats.outputTokens,
    tokensTotal: copilotStats.outputTokens,
    premiumRequests: copilotStats.premiumRequests,
    turns: copilotStats.turns,
    toolCalls: copilotStats.toolCalls,
    lastUpdated: copilotStats.lastUpdated,
  };
  broadcast('session:stats', { sessionId, stats: managed.stats });
  return managed.stats;
}

export function getSessionAzureAccount(sessionId: string): AzureAccount | null {
  return sessions.get(sessionId)?.azureAccount ?? null;
}

export function getSessionMcpServers(sessionId: string): McpServer[] {
  return sessions.get(sessionId)?.mcpServers ?? [];
}

export function getSessionAgentActivity(sessionId: string): AgentActivity | null {
  return sessions.get(sessionId)?.agentActivity ?? null;
}

export async function refreshSessionAgentActivity(sessionId: string): Promise<AgentActivity | null> {
  const managed = sessions.get(sessionId);
  if (!managed) return null;
  const activity = await forceRefreshActivity(managed.session.projectPath);
  managed.agentActivity = activity;
  broadcast('session:agentActivity', { sessionId, activity });
  return activity;
}
