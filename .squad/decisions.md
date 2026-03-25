# Squad Decisions

## Active Decisions

### 1. Tech Stack & Project Structure
**Author:** Neo (Lead)  
**Date:** 2025-01-01  
**Status:** Accepted

Monorepo using npm workspaces (`client/`, `server/`, `shared/`). React 19 + Vite + TailwindCSS v4 for client, Express 5 + TypeScript for server, WebSocket for transport, shared types via path aliases, ESM throughout with ES2022 target. Port conventions: Vite dev → 5173, Express → 3001, Vite proxies `/api` and `/ws`.

### 2. Backend API Architecture
**Author:** Morpheus  
**Date:** 2026-03-25  
**Status:** Implemented

Route separation by domain (`projects.ts`, `squad.ts`, `notifications.ts`), ENV-driven port config (3001 default), soft delete for projects (status: 'archived'), plain regex squad-reader with no markdown parsing library. 12 REST endpoints total plus WebSocket for real-time updates. JSON file storage approach chosen for simplicity.

### 3. Frontend Architecture & Component Structure
**Author:** Trinity (Frontend Dev)  
**Date:** 2026-03-25  
**Status:** Implemented

React Router v7 with Layout wrapper and `<Outlet />`, React Context for notifications (WebSocket-driven), local state for everything else (no Redux/Zustand), inline modal components with backdrop blur, CSS Grid responsive layout (1/2/3 columns), hooks use `.tsx`, pure logic uses `.ts`. Builds to ~88 KB gzipped.

### 4. Copilot CLI Prompt-Response Pattern
**Author:** Morpheus  
**Date:** 2025-07-18  
**Status:** Implemented

Copilot CLI requires real TTY to produce output. Replaced persistent-process model with one-shot `copilot -p "message"` pattern. Sessions remain active in memory between prompts (logical sessions, not process sessions). Each `sendInput()` spawns new child process, collects stdout/stderr, broadcasts via WebSocket. Uses shell escape on Windows (`cmd.exe /C`) for correct PATH resolution. Busy guard prevents concurrent prompts. Stderr stats extracted and broadcast as system messages.

### 5. Electron Main Process Migration
**Author:** Morpheus  
**Date:** 2025-07-18  
**Status:** Implemented

Converting squadCenter from client/server web app to standalone Electron desktop app. All server logic in `electron/` directory. WebSocket replaced by Electron IPC via `BrowserWindow.webContents.send()`. Minimal HTTP server on port 3001 remains only for Copilot CLI hook callbacks. Data directory: `app.getPath('userData')/data` when packaged, `process.cwd()/data` in dev. 19 IPC channels for projects/sessions/filesystem/notifications/hooks, 5 event channels. Removed express/cors/ws dependencies, added electron and vite plugins. Same data shapes as Express routes — no breaking changes for renderer.

### 6. Electron IPC Renderer Migration
**Author:** Trinity  
**Date:** 2025-07-18  
**Status:** Implemented

Migrating React renderer from `client/src/` to `src/` at project root. Replaced all `fetch()` calls (23 channels) with `window.electronAPI.invoke()`. Created `useIpcEvents` hook to replace WebSocket, preserving interface (`messages`, `connected`, `send`) to minimize component changes. Switched `BrowserRouter` to `HashRouter` for file:// protocol compatibility. Added `src/types/electron.d.ts` for TypeScript declarations. Root `index.html` points to `/src/main.tsx`. All downstream components updated. `client/` directory preserved for reference — cleanup is separate task.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
