import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * Dashboard tests — verify the main dashboard UI shows projects,
 * navigation elements, and notification center.
 */

let app: ElectronApplication;
let page: Page;

test.describe('Dashboard', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('shows the "New Project" button', async () => {
    const newProjectBtn = page.locator('text=New Project');
    await expect(newProjectBtn).toBeVisible({ timeout: 5000 });
  });

  test('shows the "Import" button', async () => {
    const importBtn = page.locator('text=Import');
    await expect(importBtn).toBeVisible({ timeout: 5000 });
  });

  test('notification bell is visible', async () => {
    // Look for the Bell icon (notification center trigger)
    const bell = page.locator('[data-testid="notification-bell"], button:has(svg)').first();
    await expect(bell).toBeVisible({ timeout: 5000 });
  });

  test('clicking "New Project" opens the creation form', async () => {
    const newProjectBtn = page.locator('text=New Project');
    await newProjectBtn.click();

    // Should show a project creation modal/form with name input
    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="project" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Close/cancel if there's a cancel button or escape
    const cancelBtn = page.locator('text=Cancel').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('clicking "Import" opens the folder browser', async () => {
    const importBtn = page.locator('text=Import');
    await importBtn.click();
    await page.waitForTimeout(500);

    // The folder browser should show up with a path or directory listing
    const folderBrowser = page.locator('text=Select a project folder').or(
      page.locator('[class*="modal"], [class*="dialog"], [class*="fixed"]').first()
    );
    await expect(folderBrowser).toBeVisible({ timeout: 5000 });

    // Close it
    const cancelBtn = page.locator('text=Cancel').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
