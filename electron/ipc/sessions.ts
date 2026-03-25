import type { IpcMain } from 'electron';
import {
  startSession,
  startCopilotSession,
  stopSession,
  sendInput,
  getSession,
  getSessionOutput,
  getSessionMessages,
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
  ipcMain.handle('sessions:create', (_event, { projectId, projectPath, type }: { projectId: string; projectPath: string; type?: string }) => {
    if (!projectId || !projectPath) throw new Error('projectId and projectPath are required');
    const session = type === 'copilot'
      ? startCopilotSession(projectId, projectPath)
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
}
