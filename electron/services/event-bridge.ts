import type { BrowserWindow } from 'electron';

type EventType =
  | 'project-updated'
  | 'notification'
  | 'agent-status-changed'
  | 'session:output'
  | 'session:status'
  | 'session:ptyData'
  | 'session:stats'
  | 'session:agentActivity'
  | 'hook:event';

let mainWindow: BrowserWindow | null = null;

export function setBrowserWindow(win: BrowserWindow): void {
  mainWindow = win;
  win.on('closed', () => {
    mainWindow = null;
  });
}

export function broadcast(type: EventType | string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send(`event:${type}`, payload);
  } catch {
    // Window may have been destroyed between the check and the send
  }
}
