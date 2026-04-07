import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Detect context: development clone (has electron/ dir) vs npm global install
const isDev = existsSync(join(root, 'electron'));

if (isDev) {
  console.log('📦 Development context — patching node-pty...');
  await import('./patch-node-pty.js');
} else {
  console.log('📦 Installing Squad Center binary...');
  await import('./install.js');
}
