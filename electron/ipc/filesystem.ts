import type { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasSquadFolder: boolean;
}

interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

const HIDDEN_OR_SYSTEM = new Set([
  'node_modules',
  '$Recycle.Bin',
  'System Volume Information',
  'Recovery',
  'PerfLogs',
]);

function isHiddenOrSystem(name: string): boolean {
  return name.startsWith('.') || HIDDEN_OR_SYSTEM.has(name);
}

function getWindowsDrives(): string[] {
  try {
    const output = execSync(
      'powershell -NoProfile -Command "[System.IO.DriveInfo]::GetDrives() | ForEach-Object { $_.Name }"',
      { encoding: 'utf-8', timeout: 5000 }
    );
    const drives = output
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[A-Z]:\\$/i.test(line));
    if (drives.length > 0) return drives;
  } catch { /* fallback below */ }

  const drives: string[] = [];
  for (let code = 65; code <= 90; code++) {
    const drive = String.fromCharCode(code) + ':\\';
    try {
      execSync(`dir "${drive}" /b`, { encoding: 'utf-8', timeout: 1000, stdio: 'pipe' });
      drives.push(drive);
    } catch { /* drive doesn't exist */ }
  }
  return drives.length > 0 ? drives : ['C:\\'];
}

function isAtRoot(resolvedPath: string): boolean {
  if (process.platform === 'win32') {
    return /^[A-Z]:\\$/i.test(resolvedPath);
  }
  return resolvedPath === '/';
}

async function listDrives(): Promise<BrowseResult> {
  if (process.platform === 'win32') {
    const drives = getWindowsDrives();
    const entries: DirectoryEntry[] = [];

    for (const drive of drives) {
      let hasSquad = false;
      try {
        await fs.access(path.join(drive, '.squad'));
        hasSquad = true;
      } catch { /* no .squad */ }

      entries.push({
        name: drive,
        path: drive,
        isDirectory: true,
        hasSquadFolder: hasSquad,
      });
    }

    return { currentPath: '', parentPath: null, entries };
  }

  return browseDirectory('/');
}

async function browseDirectory(dirPath: string): Promise<BrowseResult> {
  const resolved = path.resolve(dirPath);
  const parentPath = isAtRoot(resolved) ? null : path.dirname(resolved);

  let dirEntries;
  try {
    dirEntries = await fs.readdir(resolved, { withFileTypes: true });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(`Path does not exist: ${resolved}`);
    }
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new Error(`Permission denied: ${resolved}`);
    }
    throw err;
  }

  const directories = dirEntries.filter(
    entry => entry.isDirectory() && !isHiddenOrSystem(entry.name)
  );

  const entries: DirectoryEntry[] = [];

  for (const dir of directories) {
    const fullPath = path.join(resolved, dir.name);
    let hasSquad = false;
    try {
      await fs.access(path.join(fullPath, '.squad'));
      hasSquad = true;
    } catch { /* no .squad */ }

    entries.push({
      name: dir.name,
      path: fullPath,
      isDirectory: true,
      hasSquadFolder: hasSquad,
    });
  }

  entries.sort((a, b) => {
    if (a.hasSquadFolder !== b.hasSquadFolder) {
      return a.hasSquadFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return { currentPath: resolved, parentPath, entries };
}

export function registerFilesystemHandlers(ipcMain: IpcMain): void {
  // filesystem:browse — Browse directories
  ipcMain.handle('filesystem:browse', async (_event, data?: { path?: string }) => {
    const requestedPath = data?.path;
    if (!requestedPath) {
      return listDrives();
    }
    return browseDirectory(requestedPath);
  });
}
