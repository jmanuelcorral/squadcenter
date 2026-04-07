import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './helpers';

/**
 * Notifications & Hooks Pipeline E2E tests — verify the entire flow from
 * HTTP hook callback through backend storage, IPC broadcast, and UI display.
 */

const HOOKS_URL = 'http://localhost:3001/api/hooks/event';
// Use a unique path per run so resolveProjectId always matches OUR project
const TEST_PROJECT_PATH = `C:\\e2e-hooks-test-${Date.now()}`;

let app: ElectronApplication;
let page: Page;
let testProjectId: string;

test.describe('Notifications & Hooks Pipeline', () => {
  test.beforeAll(async () => {
    ({ app, page } = await launchApp());

    // Clean up any leftover E2E test projects from previous runs
    await page.evaluate(async () => {
      const projects = await (window as any).electronAPI.invoke('projects:list');
      for (const p of projects) {
        if (p.name === 'E2E Hooks Test') {
          try { await (window as any).electronAPI.invoke('projects:delete', { id: p.id }); } catch {}
        }
      }
    });

    // Create a fresh project with our unique path
    const project = await page.evaluate(async (projPath: string) => {
      return (window as any).electronAPI.invoke('projects:create', {
        name: 'E2E Hooks Test',
        path: projPath,
      });
    }, TEST_PROJECT_PATH);
    testProjectId = project.id;

    // Clear notifications for a clean slate
    await page.evaluate(async () => {
      return (window as any).electronAPI.invoke('notifications:clear');
    });
  });

  test.afterAll(async () => {
    // Clean up test project
    if (testProjectId) {
      await page.evaluate(async (id: string) => {
        try { await (window as any).electronAPI.invoke('projects:delete', { id }); } catch {}
      }, testProjectId).catch(() => {});
    }
    if (app) await app.close();
  });

  test('hooks server responds to valid POST', async () => {
    const res = await fetch(HOOKS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'sessionStart',
        projectPath: TEST_PROJECT_PATH,
        data: { source: 'e2e-test' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.eventId).toBe('string');
    expect(json.eventId.length).toBeGreaterThan(0);
  });

  test('hook events are stored and retrievable via IPC', async () => {
    const res = await fetch(HOOKS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'userPromptSubmitted',
        projectPath: TEST_PROJECT_PATH,
        data: { prompt: 'e2e test prompt' },
      }),
    });
    expect(res.status).toBe(200);
    const { eventId } = await res.json();

    // Retrieve events via IPC using our known project ID
    const result = await page.evaluate(
      async ({ pid, eid }: { pid: string; eid: string }) => {
        const events = await (window as any).electronAPI.invoke('hooks:getEvents', {
          projectId: pid,
          limit: 100,
        });
        const match = events.find((e: any) => e.id === eid);
        return {
          match: match ? { id: match.id, eventType: match.eventType, projectId: match.projectId } : null,
          count: events.length,
        };
      },
      { pid: testProjectId, eid: eventId },
    );

    expect(result.match).toBeTruthy();
    expect(result.match!.eventType).toBe('userPromptSubmitted');
    expect(result.match!.projectId).toBe(testProjectId);
  });

  test('notification appears in UI after broadcast', async () => {
    // Clear existing notifications
    await page.evaluate(async () => {
      return (window as any).electronAPI.invoke('notifications:clear');
    });
    await page.waitForTimeout(500);

    // Simulate a notification broadcast from the main process,
    // identical to what event-bridge does: mainWindow.webContents.send('event:notification', ...)
    await app.evaluate(async ({ BrowserWindow }, payload) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('event:notification', payload);
      }
    }, {
      id: `test-notif-${Date.now()}`,
      projectId: testProjectId,
      agentName: 'SwitchBot',
      message: 'E2E pipeline verification',
      type: 'info' as const,
      read: false,
      createdAt: new Date().toISOString(),
    });

    // Wait for the unread badge (red circle on the bell button) to appear
    const badge = page.locator('.bg-red-500');
    await expect(badge).toBeVisible({ timeout: 5000 });
    const badgeText = await badge.textContent();
    expect(Number(badgeText)).toBeGreaterThanOrEqual(1);

    // Open the notification panel — the bell is inside the sidebar footer
    const bellButton = page.locator('aside .border-t button').first();
    await bellButton.click();

    // Verify the notification content is visible in the open panel
    await expect(page.getByText('E2E pipeline verification')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('SwitchBot')).toBeVisible();

    // Close the panel by clicking outside it (component uses mousedown listener)
    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  });

  test('hooks server rejects invalid requests', async () => {
    // Missing eventType
    const res1 = await fetch(HOOKS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: TEST_PROJECT_PATH }),
    });
    expect(res1.status).toBe(400);
    const json1 = await res1.json();
    expect(json1.error).toContain('required');

    // Invalid eventType
    const res2 = await fetch(HOOKS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'bogusEvent', projectPath: TEST_PROJECT_PATH }),
    });
    expect(res2.status).toBe(400);
    const json2 = await res2.json();
    expect(json2.error).toContain('Invalid eventType');

    // GET request to hooks endpoint
    const res3 = await fetch(HOOKS_URL, { method: 'GET' });
    expect(res3.status).toBe(404);

    // POST to unknown path
    const res4 = await fetch('http://localhost:3001/nonexistent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res4.status).toBe(404);
    const json4 = await res4.json();
    expect(json4.error).toBe('Not found');
  });

  test('multiple rapid hook events are all received', async () => {
    const eventTypes = [
      'sessionStart',
      'preToolUse',
      'postToolUse',
      'userPromptSubmitted',
      'sessionEnd',
    ] as const;
    const eventIds: string[] = [];

    // Fire all 5 events in parallel
    const responses = await Promise.all(
      eventTypes.map((eventType) =>
        fetch(HOOKS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType,
            projectPath: TEST_PROJECT_PATH,
            data: { batch: true, eventType },
          }),
        }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
      const json = await res.json();
      eventIds.push(json.eventId);
    }
    expect(eventIds).toHaveLength(5);

    // Give the store a moment to process
    await page.waitForTimeout(300);

    // Retrieve all stored events and verify each batch event is present
    const result = await page.evaluate(
      async ({ pid, ids }: { pid: string; ids: string[] }) => {
        const events = await (window as any).electronAPI.invoke('hooks:getEvents', {
          projectId: pid,
          limit: 200,
        });
        const foundIds = ids.filter((id) => events.some((e: any) => e.id === id));
        const types = [...new Set(events.map((e: any) => e.eventType))];
        return { total: events.length, matched: foundIds.length, types };
      },
      { pid: testProjectId, ids: eventIds },
    );

    expect(result.matched).toBe(5);
    expect(result.types).toContain('sessionStart');
    expect(result.types).toContain('preToolUse');
    expect(result.types).toContain('postToolUse');
    expect(result.types).toContain('userPromptSubmitted');
    expect(result.types).toContain('sessionEnd');
  });
});
