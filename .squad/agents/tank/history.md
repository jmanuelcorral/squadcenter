# Tank — History

## Core Context
- **Project:** squadCenter — Electron desktop app (React 19 + Vite 6 + TailwindCSS v4)
- **User:** Copilot
- **Stack:** TypeScript, Electron 35, node-pty (native module), JSON file storage
- **Build:** Vite builds renderer (dist/) + electron main (dist-electron/), electron-builder for packaging
- **CI/CD:** GitHub Actions — ci.yml (build/test), release.yml (build + publish on tag push)
- **Current release:** v0.1.1 — outputs: NSIS installer (Windows), AppImage + deb (Linux), DMG (macOS)
- **Key config:** package.json `build` section has electron-builder config with `publish.releaseType: "release"` and `publish.provider: "github"`
- **Volta:** Node.js managed via Volta — use full path for npm commands
- **Known issue (fixed):** electron-builder `releaseType` must be `"release"` (not default `"draft"`) for compatibility with `gh release create`

## Learnings
