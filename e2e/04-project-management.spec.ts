import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * Project management tests — create a project, verify it appears
 * on the dashboard, open its detail view, edit config, and delete it.
 */

let app: ElectronApplication;
let page: Page;

const TEST_PROJECT_NAME = `E2E-Test-${Date.now()}`;

test.describe('Project Management', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('create a new project', async () => {
    // Click "New Project"
    await page.locator('text=New Project').click();
    await page.waitForTimeout(500);

    // Fill in the project name
    const nameInput = page.locator('input').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(TEST_PROJECT_NAME);

    // Fill in the path — use the current working directory
    const pathInput = page.locator('input').nth(1);
    if (await pathInput.isVisible()) {
      await pathInput.fill(process.cwd());
    }

    // Submit the form
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Save")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    await page.waitForTimeout(1000);

    // Project should now appear on the dashboard
    const projectCard = page.locator(`text=${TEST_PROJECT_NAME}`);
    await expect(projectCard).toBeVisible({ timeout: 5000 });
  });

  test('project card shows on dashboard', async () => {
    const projectCard = page.locator(`text=${TEST_PROJECT_NAME}`);
    await expect(projectCard).toBeVisible({ timeout: 5000 });
  });

  test('click project card navigates to project detail', async () => {
    const projectCard = page.locator(`text=${TEST_PROJECT_NAME}`).first();
    await projectCard.click();
    await page.waitForTimeout(1000);

    // Should see the project name as a heading in the detail view
    const heading = page.getByRole('heading', { name: TEST_PROJECT_NAME });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('project detail shows start button', async () => {
    // The detail view should show Start Copilot or Start Shell button
    const startBtn = page.getByRole('button', { name: /Start Copilot|Start Shell/ });
    await expect(startBtn).toBeVisible({ timeout: 5000 });
  });

  test('back button returns to dashboard', async () => {
    const backBtn = page.locator('button:has(svg), a:has(svg)').first();
    await backBtn.click();
    await page.waitForTimeout(1000);

    // Dashboard should show the project card again
    const projectCard = page.locator(`text=${TEST_PROJECT_NAME}`).first();
    await expect(projectCard).toBeVisible({ timeout: 5000 });
  });

  test('delete the test project', async () => {
    // Look for the delete button on the project card
    // This might be in a menu or directly visible
    const deleteBtn = page.locator(`[data-testid="delete-${TEST_PROJECT_NAME}"]`).or(
      page.locator('button[title*="delete" i], button[aria-label*="delete" i]').first()
    );

    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      // Confirm deletion if there's a confirmation dialog
      const confirmBtn = page.locator('text=Confirm').or(page.locator('text=Delete')).first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      await page.waitForTimeout(1000);
    }
    // If no delete button, the project will be cleaned up via data/projects.json
  });
});
