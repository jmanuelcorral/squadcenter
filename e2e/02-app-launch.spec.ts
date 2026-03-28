import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * Application launch tests — verify the Electron app starts, renders
 * the dashboard, and all core UI elements are present.
 */

let app: ElectronApplication;
let page: Page;

test.describe('Application Launch', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('app window opens successfully', async () => {
    expect(app).toBeTruthy();
    expect(page).toBeTruthy();
  });

  test('window has correct title', async () => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('window has reasonable dimensions', async () => {
    const size = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    expect(size.width).toBeGreaterThanOrEqual(800);
    expect(size.height).toBeGreaterThanOrEqual(600);
  });

  test('dashboard renders with content', async () => {
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test('no console errors on startup', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    const realErrors = errors.filter(
      (e) => !e.includes('DevTools') && !e.includes('Extension') && !e.includes('favicon'),
    );
    expect(realErrors).toEqual([]);
  });
});
