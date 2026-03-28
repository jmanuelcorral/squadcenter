import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './helpers';

/**
 * Prerequisites — verify that required CLI tools are installed.
 * These must pass before any other E2E test is meaningful.
 */

test.describe('Prerequisites', () => {
  test('npm is installed and reachable', () => {
    const output = execSync('npm --version', { encoding: 'utf-8', timeout: 10_000 }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+/);
    console.log(`  ✓ npm ${output}`);
  });

  test('GitHub Copilot CLI is installed', () => {
    let output: string;
    try {
      output = execSync('copilot --version', { encoding: 'utf-8', timeout: 15_000 }).trim();
    } catch {
      try {
        output = execSync('copilot --help', { encoding: 'utf-8', timeout: 15_000 }).trim();
      } catch (e: any) {
        throw new Error(
          'GitHub Copilot CLI is not installed or not on PATH.\n' +
          `Original error: ${e.message}`,
        );
      }
    }
    expect(output.length).toBeGreaterThan(0);
    console.log(`  ✓ copilot CLI available`);
  });

  test('Squad agent is configured', () => {
    let found = false;

    // Check .github/agents/squad.agent.md
    const agentPath = path.join(PROJECT_ROOT, '.github', 'agents', 'squad.agent.md');
    if (fs.existsSync(agentPath)) {
      found = true;
    }

    // Fallback: check .squad/team.md (team has been initialized)
    if (!found) {
      const teamPath = path.join(PROJECT_ROOT, '.squad', 'team.md');
      if (fs.existsSync(teamPath)) {
        found = true;
      }
    }

    expect(found).toBe(true);
    console.log(`  ✓ Squad agent configured`);
  });
});
