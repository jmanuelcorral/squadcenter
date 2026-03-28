# Neo — History

## Project Context
- **Project:** squadCenter
- **User:** Copilot
- **Stack:** TypeScript, React 19, Vite, TailwindCSS, Node.js, Express
- **Description:** Web app for orchestrating GitHub Copilot CLI sessions with Squad. Create/import projects, view chat, monitor agent status, notifications.

## Team Context (2026-03-25 Initial Build)
- **Trinity (Frontend):** Built complete React UI with 16 files, dark theme, WebSocket notifications
- **Morpheus (Backend):** Implemented Express server with 12 API endpoints, WebSocket, JSON storage
- **Decisions merged:** 3 architectural decisions documented and agreed upon

## Learnings

- Existing repo had partial scaffolding (client/server dirs, some configs, shared types). Updated configs in-place rather than recreating.
- Server tsconfig changed from ESNext/bundler to NodeNext module resolution — correct for a Node.js runtime using ESM.
- Proxy target corrected from port 3000 → 3001 for Express server.
- Added `uuid` + `@types/uuid` to server deps (needed for generating IDs).
- Added `autoprefixer` to client devDeps.
- Upgraded Express to v5, bumped all dependency versions to latest.
- Root package.json uses npm workspaces with `concurrently` for parallel dev.
- Client tsconfig target bumped from ES2020 → ES2022 for consistency.

## 2025-07-21 — Release Architecture & electron-builder

Designed and implemented standardized release pipeline:

### Release Strategy (ADR-7)
- electron-builder for cross-platform installers (Windows NSIS, Linux AppImage/deb, macOS DMG)
- GitHub Releases as distribution target (leverages existing `GITHUB_TOKEN`)
- Semantic versioning with `v*` tag trigger for release.yml workflow
- No breaking changes to existing code

### Team Coordination (2025-07-21)
- **Morpheus (Backend):** Implemented CI/Release pipelines (ci.yml, release.yml), created `.github/copilot-instructions.md`, configured electron-builder in package.json
- **Trinity (Frontend):** Created comprehensive README.md with 13 sections (badges, features, tech stack, structure, testing, configuration docs)
- **Five inbox decisions merged into decisions.md:** CI/Release strategy, environment detection, PTY sessions, stats tracking, xterm.js terminal rendering
