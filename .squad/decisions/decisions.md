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
