# Copilot Instructions — squadCenter

## Project Overview

squadCenter is an **Electron desktop app** for orchestrating GitHub Copilot CLI sessions with Squad agent teams. It lets users manage projects, spawn interactive Copilot CLI terminals (via node-pty + xterm.js), track agent activity, and receive real-time updates through Electron IPC.

## Tech Stack

- **Language:** TypeScript (strict mode, ES2022 target)
- **Modules:** ESM throughout (`"type": "module"`)
- **Frontend:** React 19, Vite 6, TailwindCSS v4
- **Desktop:** Electron 35
- **Terminal:** node-pty (native module) + xterm.js
- **Storage:** JSON files in `data/` directory (no database)
- **Real-time:** Electron IPC (not WebSocket)
- **Testing:** Playwright E2E tests
- **Package manager:** npm (managed via Volta)

## Architecture

```
electron/          # Electron main process
  main.ts          # App entry, BrowserWindow, IPC registration
  preload.ts       # contextBridge exposes electronAPI
  hooks-server.ts  # Minimal HTTP server on port 3001 for Copilot CLI callbacks
  ipc/             # IPC handler modules (projects, sessions, filesystem, notifications, hooks)
  services/        # Backend services (storage, session-manager, squad-reader, etc.)

src/               # Renderer process (React app)
  components/      # React components
  pages/           # Route pages
  hooks/           # Custom React hooks
  types/           # TypeScript declarations

shared/            # Shared types between main and renderer
  types.ts         # Data interfaces
  ipc-channels.ts  # Type-safe IPC channel constants

e2e/               # Playwright E2E tests
data/              # JSON file storage (runtime data)
```

## Key Patterns

### IPC Communication (not REST)
All renderer↔main communication uses Electron IPC via `window.electronAPI.invoke()`. There are 19+ IPC channels for projects, sessions, filesystem, notifications, and hooks. Events are broadcast via `BrowserWindow.webContents.send()`.

### Terminal Sessions
Copilot CLI sessions are spawned as real PTY processes via `node-pty`. The renderer uses xterm.js to display terminal output. PTY data is streamed via `session:ptyData` IPC events.

### Hooks HTTP Server
A minimal Node.js HTTP server runs on port 3001 to receive POST callbacks from Copilot CLI hooks. This is the only HTTP server in the app — everything else uses IPC.

### JSON File Storage
Data is stored in JSON files under `data/` (dev) or `app.getPath('userData')/data` (packaged). No database.

## Build & Run

```bash
# Development
npm run dev          # Starts Vite dev server + Electron

# Build
npm run build        # Vite builds renderer (dist/) + electron main + preload (dist-electron/)

# Test (E2E — requires Electron display + Copilot CLI installed)
npm test             # Runs Playwright E2E tests
```

Build output:
- `dist/` — Renderer (Vite output)
- `dist-electron/` — Main process + preload (compiled JS)

## Code Style

- ESM imports everywhere (no CommonJS `require`)
- TypeScript strict mode enabled
- TailwindCSS v4 for all styling (no CSS modules or styled-components)
- React hooks pattern — no class components
- HashRouter for Electron file:// protocol compatibility
- Shared types in `shared/types.ts` — keep renderer and main process in sync

## Important Notes

### node-pty is a native module
It requires native compilation per platform. After `npm install`, it must be rebuilt for the target Electron version. Do not try to bundle it with Vite — it's externalized in `vite.config.ts`.

### Volta for Node.js version management
This project uses Volta. When running npm commands, use the full path:
```
node C:\Users\josecorral\AppData\Local\Volta\tools\image\node\22.13.0\node_modules\npm\bin\npm-cli.js
```
instead of bare `npm`.

### No Express
The app migrated from Express to Electron. There is no Express dependency. The only HTTP server is the hooks callback server (`electron/hooks-server.ts`).

### File structure conventions
- IPC handlers go in `electron/ipc/`
- Services go in `electron/services/`
- React components go in `src/components/`
- Shared types go in `shared/types.ts`
- IPC channel names go in `shared/ipc-channels.ts`
