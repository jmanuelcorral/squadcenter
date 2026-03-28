/**
 * Shared helpers for E2E tests.
 * Provides ESM-compatible __dirname and Electron launch utility.
 */
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const MAIN_JS = path.join(PROJECT_ROOT, 'dist-electron', 'main.js');

export function ensureBuilt(): void {
  if (!fs.existsSync(MAIN_JS)) {
    throw new Error(
      `Built app not found at ${MAIN_JS}.\nRun "npm run build" before E2E tests.`,
    );
  }
}

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  ensureBuilt();

  const app = await electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  return { app, page };
}
