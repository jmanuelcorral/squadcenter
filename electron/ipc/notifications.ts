import type { IpcMain } from 'electron';
import { loadNotifications, saveNotifications } from '../services/storage.js';

export function registerNotificationHandlers(ipcMain: IpcMain): void {
  // notifications:list — Get all notifications
  ipcMain.handle('notifications:list', async () => {
    return loadNotifications();
  });

  // notifications:markRead — Mark notification as read
  ipcMain.handle('notifications:markRead', async (_event, { id }: { id: string }) => {
    const notifications = await loadNotifications();
    const index = notifications.findIndex(n => n.id === id);
    if (index === -1) throw new Error('Notification not found');

    notifications[index].read = true;
    await saveNotifications(notifications);
    return notifications[index];
  });

  // notifications:clear — Clear all notifications
  ipcMain.handle('notifications:clear', async () => {
    await saveNotifications([]);
  });
}
