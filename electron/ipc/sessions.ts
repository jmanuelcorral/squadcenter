import type { IpcMain } from 'electron';
import {
  startSession,
  startCopilotSession,
  stopSession,
  sendInput,
  resizeSession,
  getSession,
  getSessionOutput,
  getSessionMessages,
  getSessionStats,
  refreshSessionStats,
  getSessionAzureAccount,
  getSessionMcpServers,
  listSessions,
} from '../services/session-manager.js';

export function registerSessionHandlers(ipcMain: IpcMain): void {
  // sessions:list — list all sessions
  ipcMain.handle('sessions:list', () => {
    return listSessions();
  });

  // sessions:get — get session details + recent messages
  ipcMain.handle('sessions:get', (_event, { id }: { id: string }) => {
    const session = getSession(id);
    if (!session) throw new Error('Session not found');
    const messages = getSessionMessages(id);
    return { ...session, messages };
  });

  // sessions:create — start a new session (shell or copilot via `type` field)
  ipcMain.handle('sessions:create', async (_event, { projectId, projectPath, type }: { projectId: string; projectPath: string; type?: string }) => {
    if (!projectId || !projectPath) throw new Error('projectId and projectPath are required');
    const session = type === 'copilot'
      ? await startCopilotSession(projectId, projectPath)
      : startSession(projectId, projectPath);
    return session;
  });

  // sessions:stop — stop a session
  ipcMain.handle('sessions:stop', (_event, { id }: { id: string }) => {
    const session = stopSession(id);
    if (!session) throw new Error('Session not found');
    return session;
  });

  // sessions:sendInput — send input to session stdin
  ipcMain.handle('sessions:sendInput', (_event, { id, text }: { id: string; text: string }) => {
    if (typeof text !== 'string') throw new Error('text is required');
    const ok = sendInput(id, text);
    return { sent: ok };
  });

  // sessions:getOutput — get buffered output lines
  ipcMain.handle('sessions:getOutput', (_event, { id }: { id: string }) => {
    const session = getSession(id);
    if (!session) throw new Error('Session not found');
    return getSessionOutput(id);
  });

  // sessions:resize — resize PTY
  ipcMain.handle('sessions:resize', (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    resizeSession(id, cols, rows);
    return { ok: true };
  });

  // sessions:getStats — get session token/premium stats
  ipcMain.handle('sessions:getStats', (_event, { id }: { id: string }) => {
    return getSessionStats(id);
  });

  // sessions:refreshStats — force refresh stats from copilot logs
  ipcMain.handle('sessions:refreshStats', async (_event, { id }: { id: string }) => {
    return refreshSessionStats(id);
  });

  // sessions:getMcpServers — get cached MCP servers for a session
  ipcMain.handle('sessions:getMcpServers', (_event, { sessionId }: { sessionId: string }) => {
    return getSessionMcpServers(sessionId);
  });

  // sessions:getAzureAccount — get cached Azure account for a session
  ipcMain.handle('sessions:getAzureAccount', (_event, { sessionId }: { sessionId: string }) => {
    return getSessionAzureAccount(sessionId);
  });
}
