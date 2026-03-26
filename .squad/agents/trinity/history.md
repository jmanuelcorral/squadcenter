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

### 2025-07-18 — Copilot Thinking/Busy State UX

Added request-response UX for copilot sessions (3 modified files):

- **SessionView.tsx:** Added `thinking` state — set to `true` on `handleSend` for copilot sessions, cleared to `false` when `session:output` WebSocket message arrives. Input disabled during thinking, placeholder switches to "Copilot is thinking..." while busy. Passes `thinking` prop to `SessionTerminal`
- **SessionTerminal.tsx:** Added `thinking` prop — renders animated violet pulsing dots indicator ("✨ Copilot is thinking") at the bottom of the terminal, before the scroll anchor. Uses staggered `animate-[pulse]` with 0.2s delays per dot
- **ChatInput.tsx:** Modified placeholder logic — when `disabled` AND a custom placeholder is provided, shows the custom placeholder instead of the generic "Session is not active" fallback
- **Build:** 305 KB JS + 52 KB CSS (~98 KB gzipped)

**Key decisions:**
- Thinking state lives in SessionView (single source of truth) — flows down as props
- Disabled input uses custom placeholder for contextual messaging ("Copilot is thinking..." vs "Session is not active")
- Violet/purple colors maintained for all copilot-specific UI elements (dots, text, sparkle)
- Pulsing dots use inline Tailwind arbitrary animation syntax — no new CSS keyframes needed

### 2025-07-18 — Electron IPC Renderer Migration

Migrated the entire React frontend from `client/src/` to `src/` and rewired all API calls for Electron IPC:

- **Root `index.html`:** Copied from `client/index.html` with `<script src="/src/main.tsx">` for Vite root resolution
- **`src/types/electron.d.ts`:** TypeScript declaration for `window.electronAPI` — `invoke`, `on`, `off`, `removeAllListeners`
- **`src/lib/api.ts`:** Replaced `fetch()`-based `request()` helper with 23 IPC invoke calls via `window.electronAPI.invoke()`. Removed `API_BASE`, `request<T>()`, all `fetch()` usage. Kept all type exports (`Session`, `SessionMessage`, `ProjectStatus`, `DirectoryEntry`, `BrowseResult`, `HookEvent`, `HookEventType`)
- **`src/hooks/useIpcEvents.ts`:** Replaces `useWebSocket.ts` — subscribes to 5 IPC event channels (`event:project-updated`, `event:notification`, `event:session:output`, `event:session:status`, `event:hook:event`). Returns `{ messages, connected, send, clearMessages }` for API compatibility. `connected` is always `true` in Electron
- **`src/hooks/useNotifications.tsx`:** Updated import from `useWebSocket` → `useIpcEvents`
- **`src/components/ActivityTimeline.tsx`:** Updated import from `useWebSocket` → `useIpcEvents`
- **`src/pages/SessionView.tsx`:** Updated import from `useWebSocket` → `useIpcEvents`, changed WS message ID prefix from `ws-` to `ipc-`
- **`src/App.tsx`:** Changed `BrowserRouter` → `HashRouter` (required for Electron `file://` protocol)
- **All other files:** Direct copies from `client/src/` preserving exact structure and behavior

**Key decisions:**
- HashRouter chosen over MemoryRouter for URL visibility in dev tools and deep-link-like behavior
- `useIpcEvents` preserves the same `{ messages, connected, send, clearMessages }` return shape as `useWebSocket` for minimal downstream changes
- IPC channel naming uses colon-separated namespaces matching main process handlers (`projects:list`, `sessions:create`, etc.)
- Old `client/` directory left untouched — cleanup is a separate task
- No changes to `package.json` or `vite.config.ts` — Morpheus handles build config

### 2025-07-19 — xterm.js Terminal Migration

Replaced custom HTML-based `SessionTerminal` with xterm.js for proper terminal rendering:

- **Dependencies:** Added `@xterm/xterm` (v5+) and `@xterm/addon-fit` to `package.json`
- **SessionTerminal.tsx:** Full rewrite — `Terminal` instance mounted to div ref, `FitAddon` for responsive resize, `ResizeObserver` for container changes (sidebar collapse). Read-only (`disableStdin: true`). ANSI color codes for message types: green for input (`> ` prefix), passthrough for output (xterm handles native ANSI from Copilot CLI), amber italic for system messages
- **Thinking indicator:** Animated dots rendered directly in terminal via `setInterval` writing ANSI — violet "✨ Copilot is thinking..." with cycling dots, cleared before new messages arrive
- **Message tracking:** `writtenCountRef` tracks messages already written to xterm, only new messages from props are appended (avoids re-rendering entire history)
- **Theme:** Dark `#0d1117` background matching existing design, GitHub-style color palette, Cascadia Code / Fira Code / JetBrains Mono font stack
- **SessionView.tsx:** No changes needed — props interface (`messages`, `loading`, `thinking`) preserved exactly
- **ChatInput.tsx:** Unchanged — stays separate, user types there, xterm is display-only
- **Build:** Vite production build passes — 640 KB JS + 58 KB CSS (xterm.js adds ~340 KB uncompressed, ~80 KB gzipped)

**Key decisions:**
- xterm.js is display-only (no stdin) — keyboard input stays in ChatInput component
- Used `@xterm/xterm` v5+ namespace (not legacy `xterm` package)
- ResizeObserver + window resize listener for responsive fit
- Thinking animation uses terminal ANSI writes (not DOM overlay) for visual consistency
- Loading skeleton kept as HTML (outside xterm) since terminal isn't initialized yet
- `convertEol: true` handles `\n` → `\r\n` conversion for proper line breaks

### 2025-07-21 — Interactive PTY Terminal Mode

Added dual-mode terminal support for live interactive Copilot sessions (3 modified files):

- **SessionTerminal.tsx:** Refactored to support `mode: 'messages' | 'pty'`. PTY mode enables stdin, blinking cursor, `convertEol: false` (PTY handles line endings), listens for `event:session:ptyData` IPC events writing raw data to xterm, forwards `term.onData` keystrokes via `sessions:sendInput`, sends `sessions:resize` on fit/resize. Cleans up all IPC listeners and xterm disposables on unmount. On `active→false`, disables stdin and prints session-ended message. Theme extracted to `TERM_THEME` const shared by both modes
- **SessionView.tsx:** Added `usePtyMode` flag (`isCopilot && isActive`). PTY mode renders `<SessionTerminal mode="pty">` and replaces ChatInput with subtle "Terminal is interactive" hint. Message mode preserved for stopped/history/shell sessions
- **api.ts:** Added `resizeSession(id, cols, rows)` IPC wrapper for `sessions:resize`
- **TypeScript:** Clean compile, zero errors

**Key decisions:**
- PTY data listener is per-component (not in `useIpcEvents`) to avoid accumulating raw terminal data in React state
- `convertEol` toggled by mode — message mode needs `true` for `\n`→`\r\n`, PTY mode needs `false` since the PTY handles it
- Terminal re-initializes when `isPty` or `sessionId` changes (useEffect deps) to properly switch modes
- Cursor color switches: blue `#58a6ff` in PTY mode (visible), background-matching in message mode (hidden)
- IPC contract: `event:session:ptyData` for raw output, `sessions:sendInput` for keystrokes, `sessions:resize` for dimensions

### 2025-07-21 — Session Sidebar Panels (Stats + Team + Activity)

Added three stacked panels to the SessionView right sidebar (2 new components, 2 modified files):

- **API layer (`lib/api.ts`):** Added `SessionStats` interface (`tokensIn`, `tokensOut`, `tokensTotal`, `premiumRequests`, `lastUpdated`) and `getSessionStats(id)` IPC wrapper for `sessions:getStats`
- **SessionStatsPanel.tsx:** Compact metrics panel — Coins icon for tokens (cyan), Zap icon for premium requests (amber). Fetches initial stats via `getSessionStats()`, subscribes to `event:session:stats` IPC events directly (not via `useIpcEvents` — avoids state accumulation). Formats large numbers (1k, 1M). Shows "—" for zero values. `font-mono` for numbers, transition animation on updates
- **SidebarTeamPanel.tsx:** Compact team roster for sidebar — fetches via existing `fetchTeam()`, renders emoji + name + role + status dot per member. Working status gets `animate-pulse`. Shows "No team configured" on empty/error. Uses `Users` icon header with member count badge
- **SessionView.tsx:** Right sidebar now stacks three panels: SessionStatsPanel → SidebarTeamPanel → ActivityTimeline. Added `overflow-y-auto` on sidebar container. Imported both new components
- **Named `SidebarTeamPanel`** (not `TeamPanel`) to avoid collision with existing `TeamPanel.tsx` which takes `members` prop directly — sidebar version handles its own data fetching

**Key decisions:**
- `event:session:stats` listener is per-component (same pattern as `event:session:ptyData`) to avoid accumulating stats in `useIpcEvents` state array
- SidebarTeamPanel is a separate component from the existing TeamPanel — different data flow (self-fetching vs prop-driven) and different layout (compact sidebar vs expandable detail)
- Sidebar container gets `overflow-y-auto` so panels can scroll if content exceeds viewport
- TypeScript compiles cleanly with zero errors
