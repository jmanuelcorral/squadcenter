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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
