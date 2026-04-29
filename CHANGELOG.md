# Changelog

All notable changes to Squad Center will be documented in this file.

## [0.3.1] - 2026-04-29

### Fixed
- **Windows Copilot launch**: Start Copilot CLI sessions through `cmd.exe /d /c` on Windows so Volta-provided `copilot.cmd` shims work with `node-pty`.
- **Resume session type safety**: Narrow resume conflicts before reading resumed session IDs, fixing CI typecheck failures.
- **Hooks server URL**: Use the runtime hooks server URL instead of a hardcoded localhost value.

### Added
- **Session launch coverage**: Add an E2E test that opens a Copilot session from the UI with a mock Copilot CLI, avoiding real credentials.
- **Resume UX improvements**: Add session resume controls, active-session conflict detection, and force-resume flow from session history.

## [0.3.0] - 2026-04-09

### Added
- **Resume Session**: Resume past Copilot CLI sessions directly from the session history panel
  - Play button on each historical session card
  - Runs `copilot --resume` to continue where the previous session left off
  - Active session conflict detection with confirmation dialog
  - "Close & Resume" option to stop current session and resume selected one

### Fixed
- **User Data Isolation**: Project configurations no longer leak between installations
  - User data (`projects.json`, `notifications.json`) removed from repository
  - Data directory auto-created on first run
  - Each installation now maintains its own workspace data

## [0.2.3] - 2026-04-07

### Fixed
- Chocolatey nuspec schema compatibility with NuGet v2.7.0
- NSIS installer artifact naming for GitHub Actions upload

## [0.2.2] - 2026-04-07

### Fixed
- Explicit NSIS `artifactName` to match CI glob patterns (spaces → hyphens)

## [0.2.1] - 2026-04-07

### Changed
- Patch release with GPG secrets configuration for apt repository

## [0.2.0] - 2026-04-07

### Added
- **Multi-channel distribution**: npm, Chocolatey, winget, apt (Debian), GitHub Releases
- npm CLI launcher with binary auto-downloader
- Chocolatey package wrapping NSIS installer
- winget manifest with auto-submission via wingetcreate
- apt repository hosted on GitHub Pages with GPG signing

## [0.1.1] - 2026-03-27

### Fixed
- Notification subscription during active sessions
- Hook event processing reliability
- Team panel real-time updates

## [0.1.0] - 2026-03-25

### Added
- Initial release
- Project management with JSON file storage
- Copilot CLI session spawning via node-pty + xterm.js
- Real-time terminal output streaming via Electron IPC
- Team visualization panel
- Session history with token/turn statistics
- Hook callback server on port 3001
- Multi-platform builds (Windows NSIS, macOS DMG, Linux AppImage/deb)
