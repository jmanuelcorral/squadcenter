# Decisions

## Copilot Session Feature (2026-03-25T14:19)
- Backend: Added copilot session type to session manager with `type: 'shell' | 'copilot'` discriminator
- API: Extended POST /api/sessions to accept `type: 'copilot'` parameter
- Session Manager: Refactored with shared `attachProcessHandlers()` to eliminate duplication
- Frontend: Added "Start Copilot" purple gradient button as primary CTA
- UI: Copilot badge (Sparkles icon) in SessionView, "Ask Copilot..." placeholder text
- ProjectStatus type updated to include sessionType field

### Key Decisions
- Session type is required (not optional) to avoid ambiguity throughout codebase
- Copilot sessions reuse ManagedSession infrastructure — sendInput, stopSession, output buffer work without changes
- Purple/violet color family for copilot differentiates from shell sessions (emerald)
- Two API paths: POST /api/sessions with body param or POST /api/sessions/copilot convenience endpoint

### Status
Complete — copilot session type fully integrated backend and frontend

---

## Folder Browser Feature (2026-03-25T13-15)
- Implemented filesystem browse API endpoint with Windows drive detection (Morpheus)
- Built visual folder browser modal with breadcrumbs, badges, and inline import buttons (Trinity)
- Fixed drive detection: switched from wmic to PowerShell for better compatibility
- Refined click UX to distinguish between navigate and select actions

### Status
Complete and integrated

---

## Copilot CLI Hooks Integration (2026-03-25T13:32)
- Monitor external Copilot CLI sessions using GitHub Copilot CLI hooks configuration
- Hooks phone home to squadCenter API via HTTP POST at sessionStart, sessionEnd, userPromptSubmitted, preToolUse, postToolUse, errorOccurred
- Combined with managed PTY sessions for launching/interacting from web UI
- Two-layer approach: hooks for monitoring external sessions, managed sessions for internal control

### Reference
https://docs.github.com/en/copilot/reference/hooks-configuration

---

## Session Management Architecture (2025-07-15)
- Sessions are ephemeral (in-memory Map), not persisted to JSON
- Use child_process.spawn for v1 (no PTY library for simplicity)
- One active session per project enforced at manager level
- Process detection uses PowerShell Get-CimInstance Win32_Process on Windows
- WebSocket extended with session:output and session:status event types

### Endpoints
- GET /api/sessions, POST /api/sessions, GET /api/sessions/:id, DELETE /api/sessions/:id
- POST /api/sessions/:id/input, GET /api/sessions/:id/output
- GET /api/projects/:id/status

---

## Hooks-Based Session Monitoring (2025-07-17)
- In-memory event store (1000 events per project, FIFO)
- POST /api/hooks/event receives events from PowerShell hook scripts
- Broadcasts via WebSocket for real-time UI updates
- Hooks generator creates .github/hooks/ config + PowerShell scripts
- Scripts are fail-silent with 5-sec timeouts

### Endpoints
- POST /api/hooks/event, GET /api/hooks/events/:projectId, GET /api/hooks/events/:projectId/activity
- POST /api/projects/:id/setup-hooks

---

## Copilot Session UI Design (2025-07-18)
- Color: Copilot uses violet/purple (from-violet-500 to-purple-600), shell stays emerald
- CTA hierarchy: "Start Copilot" full-width button, shell session secondary
- Session indicator: Sparkles icon badge with violet border in SessionView header
- Input placeholder: "Ask Copilot…" for copilot sessions

---

## Session UI Architecture (2025-07-18)
- Session types defined locally in client/src/lib/api.ts (to be refactored to shared/types once synced)
- Terminal-style view (#0d1117 background, monospace, > prefix) not chat bubbles
- Optimistic UI: messages added locally before server confirms
- Per-card status fetch on ProjectCard (acceptable for <50 projects)
- Single WebSocket connection per tab, filtered by sessionId locally
- Command history in ChatInput (50 recent, up/down navigation, not persisted)

---

## Hooks Event Stream UI Architecture (2025-07-18)
- Three-column ProjectView: Activity (2-col) | Monitoring (1-col) | Team (1-col) on desktop, 3 tabs on mobile
- ActivityTimeline supports compact prop for SessionView sidebar
- Hook types defined locally in api.ts (to be refactored to shared once synced)
- Client-side active session detection from hook events (sessionStart vs sessionEnd timestamps)
- CSS animations: animate-fade-in-up and animate-live-pulse as global keyframes in index.css

---

## CI/Release Pipeline Strategy (2025-07-21)

**Author:** Morpheus (Backend Dev)  
**Status:** Implemented

### CI Pipeline (ci.yml)
- Triggers on push/PR to `main` only
- Runs on `ubuntu-latest`
- Two type-check passes: `tsc --noEmit` (renderer) and `tsc --noEmit -p tsconfig.node.json` (electron)
- Builds with `vite build` to verify full compilation
- E2E tests skipped in CI (require Electron display and Copilot CLI)

### Release Pipeline (release.yml)
- Triggers on `v*` tag push (semantic versioning)
- Matrix build across ubuntu-latest, windows-latest, macos-latest
- electron-builder produces platform-specific distributables (NSIS, AppImage/deb, DMG)
- Publishes to GitHub Releases using `GITHUB_TOKEN`
- node-pty bundled as extraResource (native module can't be asar-packed)

### electron-builder Config
- `"build"` key in package.json keeps config co-located
- Output directory: `release/` (gitignored)
- NSIS configured for user-friendly custom install directory

---

## Environment Detection IPC Pattern (2025-07-20)

**Author:** Morpheus (Backend Dev)  
**Status:** Implemented

### Decision
- **MCP detection is per-project** — `sessions:getMcpServers` scans `.copilot/`, `.vscode/`, and user home, deduplicates by server name
- **Azure detection is global** — `sessions:getAzureAccount` reflects globally logged-in account with 5-second timeout
- **Handlers in `sessions.ts`** — both are session-context features

### IPC Contract
| Channel | Args | Returns |
|---|---|---|
| `sessions:getMcpServers` | `{ projectPath: string }` | `McpServer[]` |
| `sessions:getAzureAccount` | _(none)_ | `AzureAccount \| null` |

---

## Copilot PTY Sessions with node-pty (2025-07-19)

**Author:** Morpheus (Backend Dev)  
**Status:** Implemented

### Context
Old `copilot -p "message"` one-shot approach couldn't support interactive TUI features. Users need a real terminal experience.

### Solution
Replaced exec pattern with `node-pty` spawning a persistent PTY process running `copilot` interactively.

### IPC Contract Changes
- **New event:** `event:session:ptyData` → `{ sessionId: string, data: string }` (raw PTY output)
- **New IPC:** `sessions:resize` → `{ id: string, cols: number, rows: number }`
- **Changed:** `sessions:sendInput` sends raw text to PTY (frontend sends `\r` for Enter)
- **Removed:** Old structured `session:output` messages (all copilot output now via `session:ptyData`)

### Impact
- **Trinity (Frontend):** Must integrate xterm.js for copilot rendering
- **Neo (Lead):** Ensure electron-rebuild runs on packaging (node-pty is a native module)

---

## PTY Stats Tracking (2025-07-19)

**Author:** Morpheus (Backend Dev)  
**Status:** Implemented

### Decision
- Parse PTY output line-by-line for stats patterns using regex
- Only count what Copilot actually reports (no heuristics)
- Broadcast `session:stats` events to renderer on changes
- Expose `sessions:getStats` IPC handler for on-demand queries

### IPC Contract
- **Event:** `event:session:stats` → `{ sessionId: string, stats: { tokensIn, tokensOut, tokensTotal, premiumRequests, lastUpdated } }`
- **Handler:** `sessions:getStats` → `{ id: string }` → `SessionStats | null`

---

## xterm.js for Terminal Rendering (2025-07-19)

**Author:** Trinity (Frontend Dev)  
**Status:** Implemented

### Context
Custom HTML-based `SessionTerminal` couldn't handle ANSI escape codes from Copilot CLI, had no proper scrollback, required manual text layout.

### Decision
Replace with xterm.js (`@xterm/xterm` v5+ with `@xterm/addon-fit`) for all terminal rendering. Terminal is **read-only** — user input remains in separate `ChatInput`.

### Rationale
- Natively handles ANSI escape codes, colors, cursor positioning (critical for Copilot CLI)
- FitAddon provides responsive resizing without custom logic
- 5000-line scrollback buffer vs unbounded DOM growth
- Industry-standard (VS Code, Hyper, etc.)
- `disableStdin: true` keeps it display-only

### Impact
- `SessionTerminal.tsx` fully rewritten
- `SessionView.tsx` and `ChatInput.tsx` unchanged (same props interface)
- New dependencies: `@xterm/xterm`, `@xterm/addon-fit`
- Bundle size increase: ~340 KB uncompressed (~80 KB gzipped)

---

## Hooks Server Port Propagation (2025-07-22)

**Author:** Morpheus (Backend Dev)  
**Status:** Implemented

### Context
The hooks HTTP server falls back to a random port when 3001 is in use (EADDRINUSE). Previously, the actual port was only logged to console — never exported. Both `hooks-generator.ts` and the `projects:setupHooks` IPC handler hardcoded `http://localhost:3001`, meaning all generated hook scripts would silently POST to the wrong URL if the fallback port was used.

### Decision
1. `startHooksServer()` now returns `Promise<http.Server>` instead of `http.Server` — callers must `await` it so the port is known before any hooks are generated.
2. Module-level `actualPort` variable tracks the real listening port, exposed via `getHooksServerPort()` and `getHooksServerUrl()`.
3. All consumers (`hooks-generator.ts` default param, `projects:setupHooks` handler) now call `getHooksServerUrl()` instead of hardcoding port 3001.
4. `stopHooksServer()` resets `actualPort` to null.

### Impact
- **Breaking change:** `startHooksServer()` signature changed from sync to async. Only caller is `main.ts` (already in an async block) — updated to `await`.
- Hook scripts will now always POST to the correct port, even under port-conflict fallback.
- No frontend changes required — this is entirely backend plumbing.

---

## electron-builder releaseType Configuration (2025-07-22)

**Author:** Morpheus (Backend Dev)  
**Date:** 2025-07-22  
**Status:** Implemented

### Context
The v0.1.1 GitHub release was created successfully by the Release workflow, but all binary assets (exe, dmg, AppImage, deb) were missing. electron-builder skipped publishing every file with the error:
```
GitHub release not created  reason=existing type not compatible with publishing type
  tag=v0.1.1  version=0.1.1  existingType=release  publishingType=draft
skipped publishing  file=Squad-Center-Setup-0.1.1.exe  reason=existing type not compatible
```

### Root Cause
electron-builder defaults to `publishingType=draft`. When a release already exists and was created as a published (non-draft) release, electron-builder refuses to upload assets because the types don't match. Our workflow uses `gh release create v0.1.1` (no `--draft` flag), which creates a published release by default.

### Decision
Added `"releaseType": "release"` to `package.json` `build.publish` section to tell electron-builder to upload assets to existing **published** releases, not just drafts.

### Recovery Actions
1. Deleted the empty v0.1.1 release: `gh release delete v0.1.1 --yes`
2. Deleted the v0.1.1 tag locally and remotely: `git push origin :refs/tags/v0.1.1`
3. Committed the package.json fix with proper commit message
4. Pushed to main
5. Re-created the release: `gh release create v0.1.1 --title "..." --notes "..."`
6. Tag push re-triggered the Release workflow
7. electron-builder correctly uploaded all 9 assets (6 binaries + 3 YAML metadata files)

### Rationale
- Aligns electron-builder behavior with our workflow pattern (manual release creation via `gh release create`)
- Prevents silent upload failures when releases are created outside of electron-builder
- Works for both `workflow_dispatch` triggers and tag push triggers

---

## Add workflow_dispatch to GitHub Actions Workflows (2026-03-26)

**Author:** Morpheus (Backend Dev)  
**Status:** Implemented

### Summary
Added `workflow_dispatch:` trigger to four GitHub Actions workflows to allow manual triggering from the GitHub UI.

### Workflows Modified
1. **ci.yml** — Added `workflow_dispatch:` to triggers
2. **release.yml** — Added `workflow_dispatch:` to triggers
3. **squad-issue-assign.yml** — Added `workflow_dispatch:` to triggers
4. **squad-triage.yml** — Added `workflow_dispatch:` to triggers

### Workflows Already Configured
- `sync-squad-labels.yml` ✅
- `squad-heartbeat.yml` ✅

### Benefits
- **Flexibility:** Team can manually trigger critical workflows without waiting for event conditions
- **Testing:** Easier to test workflow behavior during development
- **Debugging:** Can re-run workflows to verify fixes without modifying code
- **Non-breaking:** All existing automatic triggers remain intact

---

## E2E Test Data Isolation Pattern (2026-07-04)

**Author:** Switch (Tester)  
**Status:** Implemented

### Context
`resolveProjectId()` in `hook-event-store.ts` uses `Array.find()` to match projects by path, returning the first match. Multiple test runs accumulate duplicate projects in `data/projects.json`, causing hooks to resolve to stale project IDs.

### Decision
E2E tests that create projects should:
1. Use a **unique project path per test run** (e.g., `C:\\e2e-hooks-test-${Date.now()}`)
2. **Clean up leftover test projects** in `beforeAll` before creating new ones
3. **Delete test projects** in `afterAll`

### Consequences
- Tests are isolated regardless of previous test run state
- No accumulation of orphaned test data in `data/projects.json`
- Pattern established in `e2e/08-notifications-hooks.spec.ts` for future test specs to follow

---

## Stable IPC Message IDs for Event Tracking (2025-07-21)

**Author:** Trinity (Frontend Dev)  
**Status:** Implemented

### Context
The `useIpcEvents` hook caps its message array at 200 items by slicing to 100. All consumers (SessionView, ActivityTimeline, useNotifications) tracked their read position by array index or length. After a cap event, indices became invalid and consumers silently stopped receiving updates.

### Decision
Added a monotonically incrementing `id: number` field to every `IpcMessage`. The counter (`let nextMsgId = 0`) lives at module scope so it persists across re-renders and remounts. All consumers now track `lastProcessedIdRef` (initialized to -1) and filter new messages with `m.id > lastProcessedIdRef.current`.

### Consequences
- **Positive:** Array capping is now safe — IDs are position-independent. Batch message processing works correctly. No more silent update loss during active sessions.
- **Positive:** Pattern is consistent across all 3 consumers — easy to apply to future IPC subscribers.
- **Trade-off:** `.filter()` on every render is O(n) over the message array (max 200 items) — negligible cost.
- **Convention:** Any new consumer of `useIpcEvents().messages` should use ID-based tracking, not index-based.

### Files Changed
- `src/hooks/useIpcEvents.ts` — Added `id` field + module-level counter
- `src/pages/SessionView.tsx` — `lastIpcMsgIndexRef` → `lastProcessedIdRef`
- `src/components/ActivityTimeline.tsx` — Single-message check → batch ID-filtered processing
- `src/hooks/useNotifications.tsx` — `processedCount` → `lastProcessedIdRef`

---

## Fix: NSIS Installer Naming Mismatch (2026-04-07)

**Author:** Tank (DevOps)  
**Status:** Implemented  
**Commit:** ee14ff9

### Problem
Windows release workflow was failing in `publish-chocolatey` and `publish-winget` jobs because they couldn't find the NSIS installer artifact.

**Root cause:** electron-builder defaults to spaces in NSIS filenames:
- Actual file: `Squad Center Setup 0.2.1.exe` (spaces)
- Workflow glob: `release/Squad-Center-Setup-*.exe` (hyphens)
- Result: No files matched → upload-artifact found nothing

Note: GitHub Release display shows hyphens because GitHub auto-sanitizes spaces, but the LOCAL file still uses spaces.

### Solution
Added explicit `artifactName` to the NSIS config in `package.json`:

```json
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowToChangeInstallationDirectory": true,
  "artifactName": "Squad-Center-Setup-${version}.${ext}"
}
```

This ensures:
- Local file: `Squad Center Setup 0.2.1.exe` → electron-builder names it `Squad-Center-Setup-0.2.1.exe`
- Workflow glob: `release/Squad-Center-Setup-*.exe` ✅ matches
- GitHub release: Consistent hyphenated filename

### Impact
- ✅ Chocolatey and winget publish jobs can now find the artifact
- ✅ No breaking changes to any other build targets
- ✅ Consistent naming across local, CI, and GitHub Release

### Files Changed
- `package.json` — Added `artifactName` to NSIS config (1 line)
