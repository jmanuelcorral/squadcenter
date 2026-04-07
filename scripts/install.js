import { createWriteStream, mkdirSync, existsSync, chmodSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cacheDir = join(root, 'bin', '.cache');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const GITHUB_RELEASE_BASE = `https://github.com/jmanuelcorral/squadcenter/releases/download/v${version}`;
const MAX_REDIRECTS = 5;

function getAssetInfo() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    return { filename: `Squad-Center-Setup-${version}.exe`, executable: false };
  }
  if (platform === 'linux' && arch === 'x64') {
    return { filename: `Squad-Center-${version}.AppImage`, executable: true };
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return { filename: `Squad-Center-${version}-arm64.dmg`, executable: false };
  }

  return null;
}

function httpGet(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    mod.get(url, resolve).on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;

    const followRedirects = (currentUrl) => {
      httpGet(currentUrl)
        .then((response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            redirectCount++;
            if (redirectCount > MAX_REDIRECTS) {
              reject(new Error('Too many redirects'));
              return;
            }
            followRedirects(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'], 10);
          let downloadedBytes = 0;

          const file = createWriteStream(dest);

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes) {
              const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
              const dlMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
              const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
              process.stdout.write(`\r  ⬇ ${dlMB} MB / ${totalMB} MB (${pct}%)`);
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            if (totalBytes) process.stdout.write('\n');
            resolve();
          });

          file.on('error', (err) => {
            file.close();
            reject(err);
          });
        })
        .catch(reject);
    };

    followRedirects(url);
  });
}

export async function install() {
  const asset = getAssetInfo();

  if (!asset) {
    console.warn(`⚠ Unsupported platform: ${process.platform}-${process.arch}`);
    console.warn('  Squad Center binaries are available for:');
    console.warn('    • Windows (x64)');
    console.warn('    • Linux (x64)');
    console.warn('    • macOS (arm64)');
    return;
  }

  const destPath = join(cacheDir, asset.filename);

  if (existsSync(destPath)) {
    console.log(`✔ Squad Center v${version} already downloaded`);
    return;
  }

  mkdirSync(cacheDir, { recursive: true });

  const downloadUrl = `${GITHUB_RELEASE_BASE}/${asset.filename}`;
  console.log(`⬇ Downloading Squad Center v${version}...`);
  console.log(`  ${downloadUrl}`);

  try {
    await download(downloadUrl, destPath);

    if (asset.executable) {
      chmodSync(destPath, 0o755);
    }

    console.log(`✔ Squad Center v${version} downloaded successfully`);
  } catch (err) {
    console.error(`\n✖ Download failed: ${err.message}`);
    console.error('  You can download manually from:');
    console.error(`  https://github.com/jmanuelcorral/squadcenter/releases/tag/v${version}`);
    process.exit(1);
  }
}

await install();
