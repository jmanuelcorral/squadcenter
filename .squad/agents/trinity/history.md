# Trinity — History

## Project Context
- **Project:** squadCenter
- **User:** Copilot
- **Stack:** React 19, TypeScript, Vite, TailwindCSS
- **Description:** Frontend for a web app that orchestrates GitHub Copilot CLI sessions with Squad.

## Learnings

### 2026-03-25 — Full Frontend Build

Built the complete React frontend (16 files across components, pages, hooks, lib):

- **Entry:** `main.tsx`, `index.css` (Tailwind v4 with custom scrollbar + pulse animation)
- **Routing:** `App.tsx` — BrowserRouter with Layout wrapper, NotificationProvider context, routes for `/` and `/project/:id`
- **Layout:** `Layout.tsx` + `Sidebar.tsx` — fixed sidebar (w-64) with gradient edge glow, logo, nav, notification bell
- **Pages:** `Dashboard.tsx` (project grid + empty state + modals), `ProjectView.tsx` (two-column: activity feed + team panel, mobile tab toggle, delete confirmation)
- **Components:** `ProjectCard.tsx` (gradient top border, team emoji row, hover ring), `TeamPanel.tsx` (expandable members with status dots/pulse), `ActivityFeed.tsx` (chat-style log with skeletons), `NotificationPanel.tsx` (dropdown with type icons, clear all, unread dot), `CreateProjectModal.tsx`, `ImportProjectModal.tsx` (backdrop blur modals)
- **Data:** `lib/api.ts` (fetch wrapper with `/api/` prefix), `hooks/useWebSocket.ts` (auto-reconnect WS), `hooks/useNotifications.tsx` (context provider integrating WS + API)
- **Design:** Dark slate-950 theme, emerald-500 primary, violet-500 for agent activity, ring borders, backdrop blur, hover transitions, responsive grid

**Key decisions:**
- Used `useNotifications.tsx` (not `.ts`) because it contains JSX for the Provider component
- TypeScript is hoisted to root `node_modules` in the workspace — `tsc` must be invoked from root `node_modules/.bin/`
- Vite build produces ~266 KB JS + ~36 KB CSS gzipped to ~88 KB total
