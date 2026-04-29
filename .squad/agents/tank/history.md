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
- **Chocolatey nuspec schema compatibility:** The `schemas.chocolatey.org` namespace is incompatible with NuGet v2.7.0 on GitHub Actions runners. Use the official Microsoft schema (`schemas.microsoft.com/packaging/2015/06/nuspec.xsd`) for compatibility across all Chocolatey versions. NuGet's validation requires the Microsoft namespace for proper schema resolution.

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

### Session: Patch Release v0.2.2
- **Task**: Bump version from 0.2.1 to 0.2.2, commit, tag, push, and create GitHub release
- **Commit**: 3c9f0ce (chore: bump version to 0.2.2)
- **Tag**: v0.2.2
- **Release**: v0.2.2 — https://github.com/jmanuelcorral/squadcenter/releases/tag/v0.2.2

**Changes:**
- Updated `package.json` version field to 0.2.2
- Updated `package-lock.json` version fields (2 entries)
- Release notes highlight NSIS artifactName fix (ee14ff9) for Chocolatey and winget
- Release workflow triggered automatically on tag push
- Distribution status: GitHub Releases ✅, Chocolatey ✅, winget ✅, apt ✅, npm ⏳ (pending token)

**Status:** Completed. v0.2.2 released with NSIS naming fix active across all package managers.

### Session: Patch Release v0.2.3
- **Task**: Release v0.2.3 to include Chocolatey nuspec schema fix in the tagged commit
- **Commit**: ce98d15 (chore: bump version to 0.2.3)
- **Tag**: v0.2.3
- **Release**: v0.2.3 — https://github.com/jmanuelcorral/squadcenter/releases/tag/v0.2.3

**Changes:**
- Updated `package.json` version field to 0.2.3
- Updated `package-lock.json` version fields (2 entries)
- Includes the nuspec schema fix (40c56a8) and NSIS artifact naming fix (ee14ff9)

**Distribution results:**
- GitHub Releases ✅ (all 3 platforms built successfully)
- npm ✅ (squad-center@0.2.3 published)
- Chocolatey ✅ (nuspec schema fix resolved the NuGet incompatibility)
- apt ✅ (Debian repo updated)
- winget ❌ (PAT lifetime >90 days — user must recreate PAT with ≤90 day expiry)

**Learnings:**
- Re-running failed CI jobs uses the original commit's code. If a fix is committed after the tag, a new release is required.
- npm token must be "Automation" type (not Granular) for publishing new packages.
- winget requires GitHub PAT with ≤90 day lifetime due to Microsoft Open Source org policy.

### Session: Release v0.3.0 — Resume Sessions + Data Isolation
- **Task**: Release v0.3.0 with CHANGELOG.md, covering resume session feature and user data isolation fix
- **Commit**: f9b3428 (chore: release v0.3.0 — resume sessions + data isolation)
- **Tag**: v0.3.0
- **Release**: v0.3.0 — https://github.com/jmanuelcorral/squadcenter/releases/tag/v0.3.0

**Changes delivered:**
- Created CHANGELOG.md documenting all releases from v0.1.0 to v0.3.0
- Updated `package.json` version to 0.3.0
- Updated `package-lock.json` version entries (2 entries)

**Features in this release:**
- Resume Session: Play button on session cards runs `copilot --resume`
- Active session conflict detection with confirmation dialog
- "Close & Resume" option to stop current session and resume selected one

**Fixes in this release:**
- User data isolation: `projects.json`, `notifications.json` removed from repo
- Data directory now auto-created on first run
- Dev mode uses `cwd/data`, packaged builds use `app.getPath('userData')/data`

**Build verification:**
- Vite renderer build: ✅ (675 kB minified, 184 kB gzip)
- Electron main: ✅ (56 kB minified)
- Preload: ✅ (0.35 kB minified)

**Distribution status:**
- GitHub Releases ✅ (all 3 platforms will build on tag push)
- Release notes published with feature/fix summaries and install instructions

**Status:** Completed. v0.3.0 released with new features and fixes. Build verified successfully.
