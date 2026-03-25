import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const handler = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
