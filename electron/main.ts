import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerAllHandlers } from './ipc/index.js';
import { setBrowserWindow } from './services/event-bridge.js';
import { setDataDir } from './services/storage.js';
import { startHooksServer, stopHooksServer } from './hooks-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  // Remove the default menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  setBrowserWindow(mainWindow);

  // Dev mode: load Vite dev server URL
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Resolve data directory
const dataDir = path.join(
  app.isPackaged ? app.getPath('userData') : process.cwd(),
  'data',
);
setDataDir(dataDir);

app.whenReady().then(() => {
  // Register all IPC handlers
  registerAllHandlers(ipcMain);

  // Start the hooks HTTP server for Copilot CLI callbacks
  startHooksServer(3001);

  // Create the main window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopHooksServer();
  app.quit();
});
