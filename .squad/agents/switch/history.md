# Switch — History

## Project Context
- **Project:** squadCenter
- **User:** Copilot
- **Stack:** Vitest, TypeScript, React, Node.js
- **Description:** Testing for a web app that orchestrates GitHub Copilot CLI sessions with Squad.

## Learnings

### Copilot Session Launch Validation (2026-04-29)
- Existing E2E coverage checked `Start Copilot` button visibility and `sessions:list`, but did not actually open/create a Copilot session.
- Added `e2e/09-session-launch.spec.ts` to launch Electron with a PATH-injected mock `copilot` CLI, create a project via IPC, click `Start Copilot`, assert navigation to `#/sessions/:id`, and verify an active `copilot` session plus default args.
- Use Playwright `testInfo.outputPath(...)` for mock bins/projects so tests avoid real Copilot credentials and do not write hooks into the repository project root.
- Final Windows implementation in `electron/services/session-manager.ts` launches Copilot PTY through `cmd.exe /d /c copilot ...` so `.cmd` shims resolve reliably.

### E2E Test Infrastructure (2026-07-04)
- **Test runner:** Playwright E2E tests in `e2e/`, numbered sequentially (`01-` through `08-`), run with `workers: 1` (serial)
- **Launch pattern:** `launchApp()` from `e2e/helpers.ts` starts Electron from `dist-electron/main.js`, waits for DOM + 2s
- **IPC testing:** Use `page.evaluate(() => window.electronAPI.invoke(channel, args))` to call IPC from renderer
- **Main process testing:** Use `app.evaluate(({ BrowserWindow }, payload) => ...)` to run code in Electron main process
- **Bell button selector:** `aside .border-t button` targets the notification bell in the sidebar footer
- **Notification panel:** Opens via bell click, closes via mousedown outside (no Escape handler)
- **Badge selector:** `.bg-red-500` for the unread notification count badge

### Hooks Pipeline Architecture
- Hooks server runs on port 3001 inside Electron main process (`electron/hooks-server.ts`)
- Events stored in-memory Map keyed by normalized path (`electron/services/hook-event-store.ts`)
- `resolveProjectId()` uses `.find()` — returns FIRST matching project, not latest. Critical for test isolation.
- Hooks server does NOT create notifications — only broadcasts `hook:event` and `session:status`
- To test notification UI, simulate via `app.evaluate` → `webContents.send('event:notification', ...)`

### Key Pitfall: Test Data Isolation
- `resolveProjectId` matches project path using `.find()` (first match wins)
- Multiple test runs can accumulate duplicate projects with same path in `data/projects.json`
- **Fix:** Use unique project path per test run (`Date.now()` suffix) AND clean up old test projects in `beforeAll`
- Always clean up test projects in `afterAll` with `projects:delete`

### Key File Paths
- `e2e/08-notifications-hooks.spec.ts` — Notifications/hooks pipeline E2E tests
- `electron/hooks-server.ts` — HTTP callback server for Copilot CLI hooks
- `electron/services/hook-event-store.ts` — In-memory event storage (Map)
- `electron/services/event-bridge.ts` — Main→renderer broadcast bridge
- `src/components/NotificationPanel.tsx` — Bell + notification dropdown
- `src/hooks/useNotifications.tsx` — Notification state (merges IPC events with stored data)
- `src/hooks/useIpcEvents.ts` — Generic IPC event listener (caps at 200 messages)
