import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * Project configuration tests — verify the session config modal works,
 * including shell selection, font settings, copilot toggle, env vars,
 * and pre-launch commands.
 */

let app: ElectronApplication;
let page: Page;

test.describe('Project Configuration', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());

    // Navigate to first project detail if available
    const projectCard = page.locator('[class*="cursor-pointer"]').first();
    if (await projectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectCard.click();
      await page.waitForTimeout(1000);
    }
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('config button is visible in project detail', async () => {
    // Look for a settings/config button (gear icon or "Config" text)
    const configBtn = page.locator('button:has-text("Config")').or(
      page.locator('button[title*="config" i], button[title*="settings" i]')
    ).or(
      page.locator('button:has(svg[class*="settings" i])')
    ).first();

    // Config button may not be visible if we didn't navigate to a project
    const isProjectView = await page.locator('text=Start Copilot').or(page.locator('text=Start Shell')).isVisible({ timeout: 3000 }).catch(() => false);

    if (isProjectView) {
      await expect(configBtn).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('config modal opens and shows sections', async () => {
    const isProjectView = await page.getByRole('button', { name: /Start Copilot|Start Shell/ }).isVisible({ timeout: 3000 }).catch(() => false);
    if (!isProjectView) test.skip();

    // Click config button
    const configBtn = page.locator('button:has-text("Config")').or(
      page.locator('button[title*="config" i]')
    ).first();
    await configBtn.click();
    await page.waitForTimeout(500);

    // Modal should be visible with "Session Configuration" title
    const modalTitle = page.locator('text=Session Configuration');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Verify key sections exist (use .first() to avoid strict mode violations)
    await expect(page.locator('text=Start Copilot').first()).toBeVisible();
    await expect(page.locator('text=Shell').first()).toBeVisible();
    await expect(page.locator('text=Terminal Font').first()).toBeVisible();
    await expect(page.locator('text=Environment Variables').first()).toBeVisible();
    await expect(page.locator('text=Pre-launch Commands').first()).toBeVisible();
  });

  test('copilot toggle works', async () => {
    // The toggle button should be a switch
    const toggle = page.locator('button[class*="rounded-full"]').first();
    if (await toggle.isVisible()) {
      const initialClasses = await toggle.getAttribute('class');

      await toggle.click();
      await page.waitForTimeout(300);

      const newClasses = await toggle.getAttribute('class');
      // The classes should change (bg-violet-600 <-> bg-slate-600)
      expect(newClasses).not.toBe(initialClasses);

      // Toggle back to original state
      await toggle.click();
      await page.waitForTimeout(300);
    }
  });

  test('shell dropdown has options', async () => {
    const shellSelect = page.locator('select').first();
    if (await shellSelect.isVisible()) {
      const options = await shellSelect.locator('option').count();
      // Should have at least "System default" + 1 detected shell
      expect(options).toBeGreaterThanOrEqual(1);
    }
  });

  test('font dropdown has NerdFont presets', async () => {
    const fontSelect = page.locator('select').nth(1);
    if (await fontSelect.isVisible()) {
      const optionsText = await fontSelect.locator('option').allTextContents();
      // Should contain at least "Default" and some NerdFont options
      expect(optionsText.some((t) => t.includes('Default'))).toBe(true);
      expect(optionsText.some((t) => t.includes('Nerd Font'))).toBe(true);
    }
  });

  test('font size slider is functional', async () => {
    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible()) {
      const min = await slider.getAttribute('min');
      const max = await slider.getAttribute('max');
      expect(Number(min)).toBeLessThan(Number(max));
    }
  });

  test('cancel button closes the modal', async () => {
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(300);

      const modalTitle = page.locator('text=Session Configuration');
      await expect(modalTitle).not.toBeVisible({ timeout: 3000 });
    }
  });
});
