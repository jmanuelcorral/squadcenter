import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { ensureBuilt, MAIN_JS } from './helpers';

function prependPath(env: NodeJS.ProcessEnv, directory: string): NodeJS.ProcessEnv {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  return {
    ...env,
    [pathKey]: `${directory}${path.delimiter}${env[pathKey] ?? ''}`,
  };
}

async function writeMockCopilot(mockBin: string): Promise<void> {
  if (process.platform === 'win32') {
    await fs.writeFile(
      path.join(mockBin, 'copilot.cmd'),
      [
        '@echo off',
        'setlocal',
        'if not "%MOCK_COPILOT_ARGS_FILE%"=="" (',
        '  echo %* > "%MOCK_COPILOT_ARGS_FILE%"',
        ')',
        'echo MOCK_COPILOT_STARTED %*',
        ':loop',
        'set "line="',
        'set /p "line="',
        'if errorlevel 1 goto done',
        'echo %line%',
        'goto loop',
        ':done',
        'endlocal',
        '',
      ].join('\r\n'),
    );
    return;
  }

  const scriptPath = path.join(mockBin, 'copilot');
  await fs.writeFile(
    scriptPath,
    [
      '#!/usr/bin/env sh',
      'if [ -n "$MOCK_COPILOT_ARGS_FILE" ]; then',
      '  printf "%s\\n" "$*" > "$MOCK_COPILOT_ARGS_FILE"',
      'fi',
      'printf "MOCK_COPILOT_STARTED %s\\n" "$*"',
      'while IFS= read -r line; do',
      '  printf "%s\\n" "$line"',
      'done',
      '',
    ].join('\n'),
  );
  await fs.chmod(scriptPath, 0o755);
}

test.describe('Copilot session launch', () => {
  test('opens a Copilot session from project detail without real Copilot credentials', async ({}, testInfo) => {
    ensureBuilt();

    const mockBin = testInfo.outputPath('mock-bin');
    const projectPath = testInfo.outputPath('mock-project');
    const argsFile = testInfo.outputPath('copilot-args.txt');
    const projectName = `E2E-Mock-Copilot-${Date.now()}`;

    await fs.mkdir(mockBin, { recursive: true });
    await fs.mkdir(path.join(projectPath, '.squad'), { recursive: true });
    await writeMockCopilot(mockBin);

    let app: ElectronApplication | undefined;
    let page: Page | undefined;
    let projectId: string | undefined;
    let sessionId: string | undefined;

    try {
      app = await electron.launch({
        args: [MAIN_JS],
        env: prependPath(
          {
            ...process.env,
            NODE_ENV: 'production',
            MOCK_COPILOT_ARGS_FILE: argsFile,
          },
          mockBin,
        ),
      });

      page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const project = await page.evaluate(
        async ({ name, projectPath }) => {
          return (window as any).electronAPI.invoke('projects:create', {
            name,
            path: projectPath,
            description: 'E2E mock Copilot launch project',
          });
        },
        { name: projectName, projectPath },
      );
      projectId = project.id;

      await page.evaluate((id) => {
        window.location.hash = `/project/${id}`;
      }, projectId);

      await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: 'Start Copilot' }).click();

      await expect(page).toHaveURL(/#\/sessions\/[0-9a-f-]+/, { timeout: 15_000 });
      sessionId = await page.evaluate(() => window.location.hash.split('/').pop() ?? '');

      const session = await page.evaluate(
        async (id) => (window as any).electronAPI.invoke('sessions:get', { id }),
        sessionId,
      );

      expect(session.type).toBe('copilot');
      expect(session.status).toBe('active');
      expect(session.pid).toBeGreaterThan(0);
      expect(session.messages.some((message: { content: string }) => message.content === 'Copilot session started')).toBe(true);

      await expect
        .poll(async () => fs.readFile(argsFile, 'utf-8').catch(() => ''), { timeout: 5000 })
        .toContain('--agent squad');

      const args = await fs.readFile(argsFile, 'utf-8');
      expect(args).toContain('--yolo');
      expect(args).toContain('--allow-all');
    } finally {
      if (page && sessionId) {
        await page.evaluate(async (id) => {
          await (window as any).electronAPI.invoke('sessions:stop', { id }).catch(() => null);
        }, sessionId);
      }
      if (page && projectId) {
        await page.evaluate(async (id) => {
          await (window as any).electronAPI.invoke('projects:delete', { id }).catch(() => null);
        }, projectId);
      }
      if (app) await app.close();
    }
  });
});
