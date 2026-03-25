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
