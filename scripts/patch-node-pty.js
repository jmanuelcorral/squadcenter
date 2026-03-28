// Patches node-pty binding.gyp files to disable Spectre mitigation requirement.
// This allows building native modules without VS Spectre-mitigated libraries.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

const filesToPatch = [
  join(root, 'node_modules', 'node-pty', 'binding.gyp'),
  join(root, 'node_modules', 'node-pty', 'deps', 'winpty', 'src', 'winpty.gyp'),
];

let patched = 0;
for (const file of filesToPatch) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes("'SpectreMitigation': 'Spectre'")) {
    const updated = content.replace(
      /'SpectreMitigation': 'Spectre'/g,
      "'SpectreMitigation': 'false'"
    );
    writeFileSync(file, updated);
    patched++;
    console.log(`✔ Patched Spectre mitigation: ${file}`);
  }
}

if (patched === 0) {
  console.log('ℹ No Spectre mitigation patches needed');
}
