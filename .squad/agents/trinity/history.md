# Trinity — History

## Project Context
- **Project:** squadCenter
- **User:** Copilot
- **Stack:** React 19, TypeScript, Vite, TailwindCSS
- **Description:** Frontend for a web app that orchestrates GitHub Copilot CLI sessions with Squad.

## Team Context (2026-03-25 Initial Build)
- **Neo (Lead):** Set up monorepo, shared types, Vite + Express proxy config
- **Morpheus (Backend):** Implemented 12 API endpoints, WebSocket service
- **Decisions merged:** 3 architectural decisions finalized

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

### 2025-07-17 — Import Modal Folder Browser

Replaced the plain text input in `ImportProjectModal.tsx` with a full visual folder browser:

- **API layer:** Added `DirectoryEntry`, `BrowseResult` types and `browseFolders()` to `lib/api.ts` — calls `GET /api/filesystem/browse?path=`
- **Breadcrumb navigation:** Clickable path segments with Home root button, handles both Windows (`D:\`) and Unix (`/`) paths
- **Folder list:** Scrollable (`max-h-80`) entries with single-click select, double-click navigate-into, parent directory button
- **Squad detection:** Folders with `.squad/` get emerald badge + ring highlight; import button turns emerald when selected
- **Warning state:** Amber warning when selected folder lacks `.squad/`, still allows import
- **Loading/error:** Skeleton rows while fetching, inline error display with AlertTriangle icon
- **Preserved:** Existing success state (team members display) kept intact
- **Icons:** Folder, FolderOpen, ChevronRight, ArrowUp, Home, Check, AlertTriangle, Loader2, HardDrive from lucide-react
- **Build:** Vite production build passes cleanly (~272 KB JS + ~38 KB CSS)

### 2025-07-18 — Session UI Build

Built the complete session management UI (3 new files, 5 modified files):

- **API layer:** Added `Session`, `SessionMessage`, `ProjectStatus` types and 6 API functions (`getSessions`, `getSession`, `startSession`, `stopSession`, `sendSessionInput`, `getProjectStatus`) to `lib/api.ts`
- **SessionTerminal.tsx:** Terminal-style output component — monospace font, `#0d1117` dark background, color-coded messages (green input with `> ` prefix, white output, amber italic system), auto-scroll via `useEffect` + ref, loading skeleton state
- **ChatInput.tsx:** Input bar with gradient send button, Enter-to-send, command history (up/down arrow, 50 entries), disabled state when session inactive, dark theme matching terminal
- **SessionView.tsx:** Full-page session page — header with back nav + project name + status badge + stop button, terminal body, chat footer. Loads session data on mount, subscribes to WebSocket for real-time `session:output` and `session:status` events, optimistic UI for sent messages
- **ProjectCard.tsx:** Added pulsing green dot for active sessions (using ping animation), gray dot for inactive. "Enter Session" button (emerald) navigates to session, "Launch Session" button starts new session. Fetches `getProjectStatus` on mount
- **Sidebar.tsx:** Added "Sessions" nav item with Terminal icon and active count badge (polls every 10s via `getSessions`)
- **Dashboard.tsx:** Added active session count badge in header area, fetches session count on mount
- **App.tsx:** Added `/sessions/:id` route pointing to `SessionView`
- **useWebSocket.ts:** Fixed pre-existing React 19 `useRef` typing issue (needed `undefined` initial value)
- **Build:** Vite production build passes — 283 KB JS + 43 KB CSS (~93 KB gzipped)

**Key decisions:**
- Session types defined locally in `api.ts` (Morpheus adding to `shared/types.ts` in parallel — can refactor to shared import later)
- WebSocket integration reuses existing `useWebSocket` hook — filters messages by `sessionId`
- Optimistic UI for input messages — adds to local state immediately, server echoes back via WS
- ProjectCard fetches status independently per-card (avoids lifting state; API calls are cheap)
- Terminal uses native `animate-ping` for the active dot pulse, custom `animate-pulse-dot` for status badges

### 2025-07-18 — Hooks Event Stream UI

Built the Copilot CLI hooks monitoring layer (2 new components, 4 modified files):

- **API layer:** Added `HookEvent`, `HookEventType` types and 3 API functions (`getHookEvents`, `getHookActivitySummary`, `setupProjectHooks`) to `lib/api.ts`
- **ActivityTimeline.tsx:** Showcase real-time event timeline — vertical layout with left-border accent colors per event type (emerald session, blue prompt, orange tool, red error), filter pills, live/idle indicator with pulsing dot, auto-scroll toggle, relative timestamps updating every 15s, `animate-fade-in-up` for new events, WebSocket `hook:event` subscription, compact mode for sidebar panels
- **SetupHooksButton.tsx:** Multi-state button (idle → loading → success/error), full-size with info tooltip + inline link variant for cards, shows hooks path on success with `animate-live-pulse` ring
- **ProjectView.tsx:** Expanded to three-column layout (Activity | Monitoring | Team) with 4-col grid, added "Monitoring" mobile tab with event count badge, SetupHooksButton in header next to delete, fetches hook event count on mount
- **ProjectCard.tsx:** Added hook event awareness — detects active copilot session from hook events (sessionStart without later sessionEnd) for green pulsing dot, shows "Last active: Xm ago" with Clock icon, inline "Setup Hooks" link when no recent events
- **SessionView.tsx:** Split layout with collapsible right panel (w-80) showing compact ActivityTimeline, toggle button with PanelRightOpen/Close icons, panel has live cyan pulsing header dot
- **index.css:** Added `animate-fade-in-up` (0.3s ease-out translateY) and `animate-live-pulse` (2s emerald box-shadow ring) keyframe animations
- **Build:** Vite production build passes — 299 KB JS + 47 KB CSS (~97 KB gzipped)

**Key decisions:**
- Hook types defined locally in `api.ts` (same pattern as Session types — Morpheus syncing to shared/types.ts)
- Three-column layout chosen over tabs for ProjectView — all info visible at once on desktop, tabs for mobile
- ActivityTimeline accepts `compact` prop for different contexts (full filters in ProjectView, minimal in SessionView sidebar)
- ProjectCard fetches hook events independently (same pattern as status — cheap API calls)
- Active session detection from hooks is client-side logic: latest sessionStart > latest sessionEnd

### 2025-07-18 — Copilot Session UI (Start/Stop)

Added first-class Copilot session support across the frontend (4 modified files + CSS):

- **API layer (`lib/api.ts`):** Added `type?: 'shell' | 'copilot'` to `Session` interface, added `startCopilotSession()` function that passes `type: 'copilot'` to `POST /api/sessions`
- **ChatInput.tsx:** Added optional `placeholder` prop — defaults to existing "Type a message or command…" but allows override (used for "Ask Copilot…")
- **ProjectCard.tsx:** Added prominent "Start Copilot" button as the main CTA — full-width purple gradient (`from-violet-500 to-purple-600`), Sparkles icon. When active: shows "Open Copilot" + "Stop" button pair. Shell session button demoted to secondary (smaller, bottom-right). Added `handleCopilotStart` and `handleCopilotStop` handlers with loading/stopping states
- **SessionView.tsx:** Copilot sessions get a violet "Copilot" badge with Sparkles icon in header, purple border accent, violet pulse dot instead of emerald, and "Ask Copilot…" placeholder in ChatInput
- **ProjectView.tsx:** Added "Start Copilot" button in project header (same purple gradient style), fetches `getProjectStatus` on mount. When running: shows "Open Copilot" with pulsing violet dot + "Stop" button
- **index.css:** Added `copilot-glow` keyframe animation (violet box-shadow pulse) for hover effect on Start Copilot button

**Key decisions:**
- Copilot button is the most prominent CTA (full-width, gradient, large) — shell session is secondary/small
- Purple/violet color family (`violet-500`, `purple-600`) distinguishes copilot from shell (emerald)
- Copilot glow animation is hover-only via inline JS style toggle (avoids constant animation fatigue)
- Session type detection uses `session.type === 'copilot'` from backend response
- Build: 304 KB JS + 51 KB CSS (~98 KB gzipped)
