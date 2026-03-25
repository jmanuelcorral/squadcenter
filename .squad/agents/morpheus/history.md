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
