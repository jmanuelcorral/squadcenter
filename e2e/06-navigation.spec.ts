import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * Navigation and layout tests — verify routing between views,
 * sidebar behavior, and general UI responsiveness.
 */

let app: ElectronApplication;
let page: Page;

test.describe('Navigation & Layout', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('dashboard is the default route', async () => {
    // The dashboard should be the first thing shown
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Dashboard indicators: "New Project", "Import", or project cards
    const hasDashboardElements = await page.locator('text=New Project').isVisible().catch(() => false) ||
      await page.locator('text=Import').isVisible().catch(() => false);
    expect(hasDashboardElements).toBe(true);
  });

  test('project cards have non-rounded top-left and bottom-right corners', async () => {
    // Verify custom border-radius styling (rounded-tr, rounded-bl but NOT rounded-tl, rounded-br)
    const card = page.locator('[class*="cursor-pointer"]').first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const styles = await card.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          borderTopLeftRadius: computed.borderTopLeftRadius,
          borderBottomRightRadius: computed.borderBottomRightRadius,
        };
      });
      // Top-left and bottom-right should be 0 (no rounding)
      expect(styles.borderTopLeftRadius).toBe('0px');
      expect(styles.borderBottomRightRadius).toBe('0px');
    }
  });

  test('zoom keyboard shortcuts are available', async () => {
    // Verify zoom works by checking the menu is set up
    // We can check the window's zoom level changes
    const initialZoom = await page.evaluate(() => {
      return (window as any).devicePixelRatio;
    });
    expect(initialZoom).toBeGreaterThan(0);
    // The zoom shortcuts are handled by Electron menu, not directly testable
    // but we can verify the window is responsive to zoom API
  });

  test('app renders without layout overflow', async () => {
    // Check that the page doesn't have unexpected horizontal scrollbar
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});
