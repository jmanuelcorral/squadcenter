---
name: "mock-cli-e2e"
description: "Test Electron session launches by PATH-injecting mock CLIs"
domain: "testing"
confidence: "high"
source: "earned"
---

## Context

Use this when an E2E test must verify that Electron can launch an interactive external CLI, but the real tool would require credentials, network access, or destructive side effects.

## Patterns

- Create a per-test mock binary directory with `testInfo.outputPath('mock-bin')`.
- Write a platform-specific command shim there (`tool.cmd` on Windows, executable `tool` script elsewhere).
- Launch Electron manually with the mock directory prepended to the environment `PATH`.
- Put any mock project/workspace under `testInfo.outputPath(...)` so generated files do not dirty the repository root.
- Drive the real renderer action, then assert IPC-visible session state and any captured mock arguments.

## Examples

- `e2e/09-session-launch.spec.ts` creates a mock `copilot` command, opens a project detail page, clicks `Start Copilot`, verifies navigation to `#/sessions/:id`, and checks the default Copilot args without using real Copilot credentials.

## Anti-Patterns

- Do not depend on the real external CLI for deterministic E2E coverage when credentials or network state are unrelated to the app wiring under test.
- Do not create mock binaries or generated hook files under the repository project root; use Playwright test output paths.
- Do not replace renderer behavior with direct service calls when the bug is in the user launch path; click the real UI control when possible.
