import type { IpcMain } from 'electron';
import {
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
  getSessionAgentActivity,
  refreshSessionAgentActivity,
  listSessions,
} from '../services/session-manager.js';
import { listSessionHistory } from '../services/copilot-log-watcher.js';
import { loadProjects } from '../services/storage.js';

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

  // sessions:create — start a new copilot session
  ipcMain.handle('sessions:create', async (_event, { projectId, projectPath, copilotConfig }: { projectId: string; projectPath: string; copilotConfig?: any }) => {
    if (!projectId || !projectPath) throw new Error('projectId and projectPath are required');
    const session = await startCopilotSession(projectId, projectPath, copilotConfig);
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

  // sessions:getAgentActivity — get agent activity for a session
  ipcMain.handle('sessions:getAgentActivity', (_event, { id }: { id: string }) => {
    return getSessionAgentActivity(id);
  });

  // sessions:refreshAgentActivity — force refresh agent activity from copilot logs
  ipcMain.handle('sessions:refreshAgentActivity', async (_event, { id }: { id: string }) => {
    return refreshSessionAgentActivity(id);
  });

  // sessions:restart — stop and restart a copilot session
  ipcMain.handle('sessions:restart', async (_event, { sessionId, projectId, projectPath }: { sessionId: string; projectId: string; projectPath: string }) => {
    stopSession(sessionId);
    // Small delay for cleanup
    await new Promise(r => setTimeout(r, 500));
    // Load the project's saved copilotConfig
    const projects = loadProjects();
    const project = projects.find(p => p.id === projectId);
    const session = await startCopilotSession(projectId, projectPath, project?.copilotConfig);
    return session;
  });

  // sessions:history — list all copilot session history for a project
  ipcMain.handle('sessions:history', async (_event, { projectPath }: { projectPath: string }) => {
    return listSessionHistory(projectPath);
  });
}
