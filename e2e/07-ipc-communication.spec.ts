import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * IPC communication tests — verify that the Electron IPC bridge works
 * correctly between renderer and main process.
 */

let app: ElectronApplication;
let page: Page;

test.describe('IPC Communication', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('electronAPI is exposed on window', async () => {
    const hasAPI = await page.evaluate(() => {
      return typeof (window as any).electronAPI !== 'undefined';
    });
    expect(hasAPI).toBe(true);
  });

  test('electronAPI.invoke is a function', async () => {
    const isFunction = await page.evaluate(() => {
      return typeof (window as any).electronAPI.invoke === 'function';
    });
    expect(isFunction).toBe(true);
  });

  test('electronAPI.on is a function', async () => {
    const isFunction = await page.evaluate(() => {
      return typeof (window as any).electronAPI.on === 'function';
    });
    expect(isFunction).toBe(true);
  });

  test('projects:list IPC returns an array', async () => {
    const result = await page.evaluate(async () => {
      const projects = await (window as any).electronAPI.invoke('projects:list');
      return Array.isArray(projects);
    });
    expect(result).toBe(true);
  });

  test('sessions:list IPC returns an array', async () => {
    const result = await page.evaluate(async () => {
      const sessions = await (window as any).electronAPI.invoke('sessions:list');
      return Array.isArray(sessions);
    });
    expect(result).toBe(true);
  });

  test('notifications:list IPC returns an array', async () => {
    const result = await page.evaluate(async () => {
      const notifications = await (window as any).electronAPI.invoke('notifications:list');
      return Array.isArray(notifications);
    });
    expect(result).toBe(true);
  });

  test('filesystem:browse IPC returns drives/directories', async () => {
    const result = await page.evaluate(async () => {
      const data = await (window as any).electronAPI.invoke('filesystem:browse');
      return data && typeof data === 'object' && ('entries' in data || 'drives' in data || Array.isArray(data));
    });
    expect(result).toBe(true);
  });

  test('filesystem:availableShells IPC returns shells list', async () => {
    const result = await page.evaluate(async () => {
      const shells = await (window as any).electronAPI.invoke('filesystem:availableShells');
      return Array.isArray(shells) && shells.length > 0;
    });
    expect(result).toBe(true);
  });

  test('notifications:clear IPC works', async () => {
    const success = await page.evaluate(async () => {
      try {
        await (window as any).electronAPI.invoke('notifications:clear');
        return true;
      } catch {
        return false;
      }
    });
    expect(success).toBe(true);
  });
});
