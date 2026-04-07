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
- **GPG for apt:** Key generation is batch-friendly and non-interactive with `%no-protection`. Private key export is straightforward; passphrase field left empty simplifies CI automation.
- **WINGET_TOKEN requires manual setup:** Cannot be generated programmatically; user must create GitHub PAT at settings/tokens with `public_repo` scope for winget-pkgs PRs.
- **Secret verification:** All 5 secrets now configured (NPM_TOKEN, CHOCO_API_KEY, GPG_PRIVATE_KEY, GPG_PASSPHRASE). Only WINGET_TOKEN remains manual.
- **NSIS installer naming mismatch:** electron-builder defaults to spaces in NSIS filenames (e.g., `Squad Center Setup 0.2.1.exe`), but CI globs expect hyphens. Explicit `artifactName` in package.json ensures local file matches the glob pattern; GitHub then sanitizes spaces to hyphens in the release.

## Sessions

### Session: Package Manager Distribution (v0.2.0)
- **Task**: Add npm, Chocolatey, winget, and apt distribution to the release pipeline
- **Commits**: 9573748 (feat: package manager distribution), 2c21670 (version bump to 0.2.0)
- **Release**: v0.2.0 — https://github.com/jmanuelcorral/squadcenter/releases/tag/v0.2.0

**Files created:**
- `bin/squad-center.js` — npm CLI launcher (detached spawn)
- `scripts/install.js` — postinstall binary downloader (GitHub Releases → bin/.cache/)
- `scripts/postinstall.js` — smart context router (dev vs npm install)
- `.npmignore` — npm publish exclusions
- `chocolatey/squad-center.nuspec` — Chocolatey package metadata
- `chocolatey/tools/chocolateyInstall.ps1` — silent NSIS install via Install-ChocolateyPackage
- `chocolatey/tools/chocolateyUninstall.ps1` — registry-based uninstall
- `chocolatey/tools/VERIFICATION.txt` — standard verification
- `chocolatey/update.ps1` — CI version/checksum updater
- `winget/jmanuelcorral.SquadCenter.yaml` — winget singleton manifest v1.6.0
- `winget/update.ps1` — CI version/SHA updater
- `apt-repo/conf/distributions` — reprepro config
- `apt-repo/conf/options` — reprepro options
- `apt-repo/setup.sh` — repo builder (reprepro + GPG)
- `apt-repo/README.md` — setup documentation

**Files modified:**
- `.github/workflows/release.yml` — 4 new publish jobs (npm, choco, winget, apt)
- `package.json` — bin, files, publishConfig for npm
- `README.md` — install instructions for all 5 methods
- `.squad/team.md` — added Tank (DevOps)
- `.squad/routing.md` — added CI/CD routing to Tank

**Architecture decisions:**
- npm uses a launcher/downloader pattern (no native deps in published package)
- Chocolatey wraps the existing NSIS installer
- winget uses wingetcreate for auto-submission to microsoft/winget-pkgs
- apt repo hosted on GitHub Pages via peaceiris/actions-gh-pages
- Secrets referenced via env vars in workflow (not interpolated in commands)
- Required secrets: NPM_TOKEN, CHOCO_API_KEY, WINGET_TOKEN, GPG_PRIVATE_KEY, GPG_PASSPHRASE

### Session: Patch Release v0.2.1
- **Task**: Bump version from 0.2.0 to 0.2.1, commit, tag, push, and create GitHub release
- **Commit**: 3ba9857 (chore: bump version to 0.2.1)
- **Tag**: v0.2.1
- **Release**: v0.2.1 — https://github.com/jmanuelcorral/squadcenter/releases/tag/v0.2.1

**Changes:**
- Updated `package.json` version field
- Updated `package-lock.json` version fields (2 entries)
- Release workflow triggered automatically on tag push
- Release notes auto-generated from commits since v0.2.0

**Status:** Completed. All 5 distribution channels (GitHub Releases, npm, Chocolatey, winget, apt) are active and will build/publish automatically.
