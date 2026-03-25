import type { IpcMain } from 'electron';
import { registerProjectHandlers } from './projects.js';
import { registerSessionHandlers } from './sessions.js';
import { registerFilesystemHandlers } from './filesystem.js';
import { registerNotificationHandlers } from './notifications.js';
import { registerHooksHandlers } from './hooks.js';

export function registerAllHandlers(ipcMain: IpcMain): void {
  registerProjectHandlers(ipcMain);
  registerSessionHandlers(ipcMain);
  registerFilesystemHandlers(ipcMain);
  registerNotificationHandlers(ipcMain);
  registerHooksHandlers(ipcMain);
}
