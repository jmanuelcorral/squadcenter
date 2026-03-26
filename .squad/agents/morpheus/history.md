# Morpheus — History

## Project Context
- **Project:** squadCenter
- **User:** Copilot
- **Stack:** Node.js, Express, TypeScript, WebSocket
- **Description:** Backend for a web app that orchestrates GitHub Copilot CLI sessions with Squad.

## Team Context (2026-03-25 Initial Build)
- **Neo (Lead):** Scaffolded monorepo structure, configs, shared types
- **Trinity (Frontend):** Built React UI with WebSocket integration, notifications
- **Decisions merged:** 3 architectural decisions finalized

## Learnings

### 2026-03-25 — Built full Express backend
- Created 8 files: index.ts, 3 route modules, 3 services, shared types
- Express + CORS + WebSocket on same HTTP server (port from `PORT` env or 3001)
- JSON file storage under `server/data/` with graceful ENOENT handling
- Squad reader parses `.squad/team.md` markdown tables via regex — no external parser libs
- All CRUD + import + team/decisions/logs/agent endpoints verified via curl
- Monorepo workspace setup hoists deps to root `node_modules`; `tsconfig.json` uses `rootDir: ".."` to include `shared/types.ts`
- WebSocket broadcasts on project-updated, notification, and agent-status-changed events

### 2025-07-14 — Added filesystem browse API + fixed project import route
- Created `server/src/routes/filesystem.ts` — `GET /api/filesystem/browse?path=` for directory browsing
  - No-path defaults to Windows drive listing (via `wmic`) or `/` on Unix
  - Returns only directories, filters hidden/system dirs, flags `.squad/` presence
  - Sorts: `.squad/` folders first, then alphabetical
- Mounted at `/api/filesystem` in `server/src/index.ts`
- Added `POST /api/projects/import` route (no `:id` param) in `projects.ts` — declared before `/:id` routes to avoid Express param collision
  - Validates `.squad/` exists at given path, parses project name from `team.md` blockquote, reads team members, creates new project entry
- All three changes compile clean with zero TypeScript errors

### 2025-07-15 — Built session management backend
- Created `server/src/services/session-manager.ts` — in-memory session lifecycle using `child_process.spawn`
  - Spawns `cmd.exe /K` (Windows) or `/bin/bash` (Unix) in the project directory
  - Tracks sessions in a `Map<string, ManagedSession>`, each with output buffer (500 lines), messages, and child process reference
  - Captures stdout/stderr, broadcasts output via WebSocket `session:output` events
  - Detects process exit/error and broadcasts `session:status` updates
  - Methods: startSession, stopSession, sendInput, getSession, getSessionOutput, getSessionMessages, listSessions, findSessionByProject, cleanupSessions
  - Deduplicates: if a session for the same projectId is already active, returns it instead of spawning another
- Created `server/src/routes/sessions.ts` — 6 REST endpoints for session CRUD + I/O
  - GET/POST `/api/sessions`, GET/DELETE `/api/sessions/:id`, POST `/api/sessions/:id/input`, GET `/api/sessions/:id/output`
- Created `server/src/routes/project-status.ts` — `GET /api/projects/:projectId/status`
  - Checks managed sessions first, then falls back to PowerShell process detection (`Get-CimInstance Win32_Process` filtering for node+copilot/ghcs)
  - Returns `{ active, managed, pid?, sessionId? }`
- Updated `shared/types.ts` with `Session`, `SessionMessage`, and `ProjectStatus` interfaces
- Extended WebSocket `EventType` union with `session:output` and `session:status`
- Mounted all routes in `server/src/index.ts` — sessions at `/api/sessions`, project-status at `/api/projects`
- TypeScript compiles clean with zero errors

### 2025-07-17 — Added hooks-based monitoring system
- Created `server/src/services/hook-event-store.ts` — in-memory event store (Map<string, HookEvent[]>)
  - Stores up to 1000 events per project (FIFO), keyed by normalized projectPath
  - Methods: addEvent, getEvents, getEventsByProject, getEventsByProjectFiltered, clearEvents, hasActiveHookSession, getActivitySummary
  - Auto-resolves projectId from projects.json via path matching
  - hasActiveHookSession tracks sessionStart/sessionEnd pairs for external session detection
- Created `server/src/routes/hooks.ts` — 3 endpoints for hook callbacks and queries
  - POST `/api/hooks/event` — receives hook callbacks, validates eventType, stores event, broadcasts via WebSocket
  - GET `/api/hooks/events/:projectId` — returns recent events with optional eventType filter + limit
  - GET `/api/hooks/events/:projectId/activity` — returns event counts grouped by type
  - sessionStart/sessionEnd events trigger both `hook:event` and `session:status` WebSocket broadcasts
- Created `server/src/services/hooks-generator.ts` — generates `.github/hooks/` config for any project
  - Writes `hooks.json` (version 1 format) with all 6 hook types configured
  - Generates 6 PowerShell scripts that read stdin JSON, POST to squadCenter API via Invoke-RestMethod
  - Scripts fail silently (try/catch) so hooks never block the CLI; 5-sec timeout on HTTP calls
- Added `POST /api/projects/:id/setup-hooks` to projects.ts — triggers hooks generation for a project
- Updated `shared/types.ts` with HookEventType union and HookEvent interface; added hookDetected to ProjectStatus
- Extended WebSocket EventType with `hook:event`
- Enhanced project-status.ts — checks hook event store for active sessions before falling back to process detection
- All routes mounted in index.ts; TypeScript compiles clean with zero errors

### 2025-07-18 — Added Copilot CLI session type
- Extended `Session` interface with `type: 'shell' | 'copilot'` field (required, no optional — clean contract)
- Added `sessionType?: 'shell' | 'copilot'` to `ProjectStatus` for status endpoint reporting
- Refactored `session-manager.ts`: extracted `attachProcessHandlers()` and `findActiveSessionForProject()` helpers to eliminate duplication between shell and copilot spawn paths
- New `startCopilotSession(projectId, projectPath)` spawns `copilot` with `shell: true` on Windows for PATH resolution
- Two ways to start copilot sessions: `POST /api/sessions` with `{ type: 'copilot' }` body field, or dedicated `POST /api/sessions/copilot` convenience endpoint
- Existing `sendInput`, `stopSession`, output buffering, and WebSocket broadcasts all work unchanged for copilot sessions — same ManagedSession infrastructure
- `project-status.ts` now includes `sessionType` in managed session responses
- TypeScript compiles clean with zero errors across all modified files

### 2025-07-18 — Rewrote copilot session to prompt-response pattern
- **Problem:** Copilot CLI is a TUI app — `spawn('copilot', [])` with piped stdio produces zero output. It requires a real TTY.
- **Solution:** `copilot -p "message"` works in non-interactive mode, producing stdout (response) + stderr (usage stats). Each invocation is one-shot request-response.
- Rewrote `startCopilotSession()` to create a logical session with NO persistent process — just a session object in the Map marked active
- `ManagedSession` now has `busy?: boolean` and `currentChild?: ChildProcess` fields for tracking in-flight prompts
- New `sendCopilotPrompt()` function: spawns `cmd.exe /C "cd /d path && copilot -p \"msg\""` per prompt, collects all stdout/stderr into buffers, broadcasts output on close
- `sendInput()` now dispatches to `sendCopilotPrompt()` for copilot sessions vs stdin-write for shell sessions
- `stopSession()` kills the in-flight `currentChild` for copilot sessions instead of trying to kill a persistent process
- Cross-platform: Windows uses `cmd.exe /C` wrapper, non-Windows uses `copilot -p` directly
- `parseStderrStats()` extracts usage info (tokens, requests) from stderr for display
- Busy-guard prevents concurrent prompts — returns false with a system message if a prompt is already executing
- Shell sessions completely untouched — zero behavioral change for existing shell flow
- TypeScript compiles clean with zero errors

### 2025-07-18 — Migrated Express+WebSocket server to Electron main process
- Created full `electron/` directory with main.ts, preload.ts, hooks-server.ts
- **Services migrated:** storage.ts (dynamic data dir via `setDataDir()`), session-manager.ts (broadcast via event-bridge instead of websocket), squad-reader.ts, hooks-generator.ts, hook-event-store.ts — all copied with updated imports
- **New event-bridge.ts** replaces websocket.ts — uses `BrowserWindow.webContents.send()` instead of WebSocket broadcast; `setBrowserWindow()` sets the target window from main.ts
- **IPC handlers:** 6 modules in `electron/ipc/` — projects.ts (11 handlers inc. status, team, decisions, logs, agent, setupHooks), sessions.ts (6 handlers), filesystem.ts, notifications.ts, hooks.ts, index.ts barrel
- **hooks-server.ts:** Minimal Node `http.createServer` on port 3001 for Copilot CLI hook POSTs — no Express dependency
- **Preload script:** contextBridge exposes `electronAPI` with invoke/on/off/removeAllListeners
- **main.ts:** app.whenReady → BrowserWindow (1400×900, dark bg #0f172a), loads Vite dev server URL or dist/index.html, registers IPC handlers, starts hooks server
- **Data directory:** Moved `server/data/` to root `data/`; storage.ts uses `app.isPackaged ? app.getPath('userData') : process.cwd()` + `/data`
- **Root configs:** New unified package.json (no workspaces, merged deps, removed express/cors/ws/concurrently), vite.config.ts with vite-plugin-electron, tsconfig.json (renderer), tsconfig.node.json (electron)
- **shared/ipc-channels.ts:** Type-safe channel name constants for both processes
- IPC contract matches the agreed spec exactly — same data shapes as Express routes
- Did NOT delete server/ or client/ directories — cleanup is a separate step
- Did NOT modify client/src/ — that's Trinity's domain

### 2025-07-19 — Refactored Copilot sessions to use node-pty for real PTY
- **Problem:** `copilot -p "msg"` one-shot mode lost all interactive TUI features. User wanted a real persistent terminal running `copilot` as an interactive PTY.
- **Solution:** Installed `node-pty` and refactored `startCopilotSession()` to spawn a real PTY via `pty.spawn('copilot', [])` with xterm-color terminal.
- Added `pty?: pty.IPty` field to `ManagedSession` interface.
- PTY `onData` streams raw terminal data via new `session:ptyData` broadcast event — frontend (xterm.js) renders it directly.
- PTY `onExit` updates session status to 'stopped'.
- `sendInput()` for copilot sessions now writes raw data directly to `pty.write(text)` — no newline appending, no structured messages. Frontend sends `\r` for enter.
- `stopSession()` for copilot sessions calls `pty.kill()` instead of killing a child process.
- New `resizeSession(sessionId, cols, rows)` exported function calls `pty.resize()` for dynamic terminal resizing.
- New IPC handler `sessions:resize` in `electron/ipc/sessions.ts` exposes resize to renderer.
- Added `session:ptyData` to EventType union in `event-bridge.ts`.
- Externalized `node-pty` in `vite.config.ts` rollupOptions so Vite doesn't try to bundle the native module.
- Removed old `sendCopilotPrompt()`, `parseStderrStats()`, and `busy`/`currentChild` fields — all replaced by PTY.
- Shell sessions (`startSession()`) completely untouched — zero behavioral change.
- **IPC contract for Trinity:**
  - `event:session:ptyData` → `{ sessionId: string, data: string }` (raw PTY output)
  - `sessions:resize` → `{ id: string, cols: number, rows: number }` (resize PTY)
  - `sessions:sendInput` → `{ id: string, text: string }` (raw input, no \n appended for copilot)
- Build succeeds with zero errors.

### 2025-07-19 — Added PTY stats tracking for token/premium request consumption
- **Problem:** Copilot CLI outputs token usage and premium request stats in the PTY data stream, but we weren't capturing them.
- **Solution:** Added line-buffered parsing of the PTY output to extract stats and broadcast them to the frontend.
- Added `SessionStats` interface (`tokensIn`, `tokensOut`, `tokensTotal`, `premiumRequests`, `lastUpdated`) and `stats` field to `ManagedSession`, initialized with zeros via `createEmptyStats()`.
- PTY `onData` handler now buffers partial lines (`lineBuffer`) and feeds complete lines to `parseStatsLine()` — handles chunk-boundary splits correctly.
- `parseStatsLine()` strips ANSI escape codes, then matches multiple regex patterns:
  - `N tokens` / `tokens: N` / `tokens used: N` → sets `tokensTotal`
  - `N in, M out` → sets `tokensIn`, `tokensOut`, recomputes `tokensTotal`
  - `N premium request(s)` / `premium requests: N` → sets `premiumRequests`
  - `requests this session: N` / `requests used: N` → sets `premiumRequests`
- On any match, broadcasts `session:stats` event with updated stats to the renderer.
- Added `'session:stats'` to EventType union in `event-bridge.ts`.
- New `getSessionStats(sessionId)` export returns stats for a session (or null).
- New `sessions:getStats` IPC handler in `electron/ipc/sessions.ts` exposes stats to renderer.
- **Decision:** Only count what Copilot reports — no increment-per-prompt heuristic. Each prompt doesn't necessarily equal one premium request.
- Build succeeds with zero errors.
