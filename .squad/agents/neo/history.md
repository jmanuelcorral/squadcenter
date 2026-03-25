# Neo — History

## Project Context
- **Project:** squadCenter
- **User:** Copilot
- **Stack:** TypeScript, React 19, Vite, TailwindCSS, Node.js, Express
- **Description:** Web app for orchestrating GitHub Copilot CLI sessions with Squad. Create/import projects, view chat, monitor agent status, notifications.

## Learnings

- Existing repo had partial scaffolding (client/server dirs, some configs, shared types). Updated configs in-place rather than recreating.
- Server tsconfig changed from ESNext/bundler to NodeNext module resolution — correct for a Node.js runtime using ESM.
- Proxy target corrected from port 3000 → 3001 for Express server.
- Added `uuid` + `@types/uuid` to server deps (needed for generating IDs).
- Added `autoprefixer` to client devDeps.
- Upgraded Express to v5, bumped all dependency versions to latest.
- Root package.json uses npm workspaces with `concurrently` for parallel dev.
- Client tsconfig target bumped from ES2020 → ES2022 for consistency.
