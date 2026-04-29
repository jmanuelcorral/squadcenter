---
name: "windows-pty-command-shims"
description: "Launch PATH commands and .cmd shims reliably from node-pty on Windows"
domain: "process-management"
confidence: "high"
source: "observed"
---

## Context

Use this when Electron main-process code launches interactive tools through `node-pty` on Windows, especially tools installed through shims such as Volta, npm global bins, or other `.cmd` wrappers.

## Patterns

- Do not assume `pty.spawn('tool', args, options)` can resolve a Windows `.cmd` shim.
- For command-shim tools, spawn the command shell and let it resolve PATH:
  ```ts
  const commandShell = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
  pty.spawn(commandShell, ['/d', '/c', 'tool', ...args], options);
  ```
- Keep non-Windows launches direct:
  ```ts
  pty.spawn('tool', args, options);
  ```
- Put platform-specific launch behavior behind one helper so start/resume/restart paths cannot drift.

## Examples

- `electron/services/session-manager.ts` uses `spawnCopilotPty()` so new Copilot sessions and resumed sessions both use the Windows `cmd.exe /d /c copilot ...` wrapper.

## Anti-Patterns

- **Direct Windows shim spawn** — `pty.spawn('copilot', args, options)` can fail with `Cannot create process, error code: 2` when `copilot` resolves to `copilot.cmd`.
- **Renderer-side workaround** — fix command launch in Electron main-process session management rather than adding retries or silent error handling in React.
