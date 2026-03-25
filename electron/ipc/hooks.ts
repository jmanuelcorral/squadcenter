import type { IpcMain } from 'electron';
import type { HookEventType } from '../../shared/types.js';
import {
  getEventsByProjectFiltered,
  getActivitySummary,
} from '../services/hook-event-store.js';

export function registerHooksHandlers(ipcMain: IpcMain): void {
  // hooks:getEvents — recent events for a project
  ipcMain.handle('hooks:getEvents', (_event, { projectId, eventType, limit }: { projectId: string; eventType?: HookEventType; limit?: number }) => {
    const clampedLimit = Math.min(limit || 50, 1000);
    return getEventsByProjectFiltered(projectId, eventType, clampedLimit);
  });

  // hooks:getActivity — summary/timeline view
  ipcMain.handle('hooks:getActivity', (_event, { projectId }: { projectId: string; limit?: number }) => {
    return getActivitySummary(projectId);
  });
}
