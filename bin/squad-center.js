#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(__dirname, '.cache');
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;

function findBinary() {
  const platform = process.platform;

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env['ProgramFiles'];

    const installedPaths = [
      localAppData && join(localAppData, 'Programs', 'Squad Center', 'Squad Center.exe'),
      programFiles && join(programFiles, 'Squad Center', 'Squad Center.exe'),
    ].filter(Boolean);

    for (const p of installedPaths) {
      if (existsSync(p)) return { path: p, type: 'app' };
    }

    const installer = join(cacheDir, `Squad-Center-Setup-${version}.exe`);
    if (existsSync(installer)) return { path: installer, type: 'installer' };
  }

  if (platform === 'linux') {
    const appImage = join(cacheDir, `Squad-Center-${version}.AppImage`);
    if (existsSync(appImage)) return { path: appImage, type: 'app' };
  }

  if (platform === 'darwin') {
    const appPath = '/Applications/Squad Center.app';
    if (existsSync(appPath)) return { path: appPath, type: 'macapp' };

    const dmg = join(cacheDir, `Squad-Center-${version}-arm64.dmg`);
    if (existsSync(dmg)) return { path: dmg, type: 'dmg' };
  }

  return null;
}

function launch(binary) {
  const { path: binPath, type } = binary;
  let child;

  switch (process.platform) {
    case 'win32':
      if (type === 'installer') {
        console.log('🚀 Running Squad Center installer...');
        console.log('   The app will launch after installation completes.');
      } else {
        console.log('🚀 Launching Squad Center...');
      }
      child = spawn(binPath, [], { detached: true, stdio: 'ignore' });
      break;

    case 'linux':
      console.log('🚀 Launching Squad Center...');
      child = spawn(binPath, [], { detached: true, stdio: 'ignore' });
      break;

    case 'darwin':
      if (type === 'macapp') {
        console.log('🚀 Launching Squad Center...');
        child = spawn('open', ['-a', binPath], { detached: true, stdio: 'ignore' });
      } else {
        console.log('🚀 Opening Squad Center disk image...');
        console.log('   Drag Squad Center to Applications, then run `squad-center` again.');
        child = spawn('open', [binPath], { detached: true, stdio: 'ignore' });
      }
      break;
  }

  if (child) {
    child.unref();
  }
}

const binary = findBinary();

if (!binary) {
  console.error('✖ Squad Center binary not found.');
  console.error('  Run `npm install -g squad-center` to download the app.');
  console.error(`  Or download manually: https://github.com/jmanuelcorral/squadcenter/releases/tag/v${version}`);
  process.exit(1);
}

launch(binary);
