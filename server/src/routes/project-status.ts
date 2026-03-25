import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findSessionByProject } from '../services/session-manager.js';
import { hasActiveHookSession } from '../services/hook-event-store.js';
import type { ProjectStatus } from '../../../shared/types.js';

const execAsync = promisify(exec);
const router = Router();

// GET /api/projects/:projectId/status — detect if copilot is running for this project
router.get('/:projectId/status', async (req, res) => {
  const { projectId } = req.params;

  // Check managed sessions first
  const managedSession = findSessionByProject(projectId);
  if (managedSession) {
    const status: ProjectStatus = {
      active: true,
      managed: true,
      pid: managedSession.pid,
      sessionId: managedSession.id,
    };
    res.json(status);
    return;
  }

  // Check hook-based session detection
  if (hasActiveHookSession(projectId)) {
    const status: ProjectStatus = {
      active: true,
      managed: false,
      hookDetected: true,
    };
    res.json(status);
    return;
  }

  // Attempt to detect external copilot processes via PowerShell (Windows)
  if (process.platform === 'win32') {
    try {
      const psCommand = `Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node' -and ($_.CommandLine -match 'copilot' -or $_.CommandLine -match 'ghcs') } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`;
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand}"`, {
        timeout: 5000,
      });

      if (stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const procs = Array.isArray(parsed) ? parsed : [parsed];
        if (procs.length > 0) {
          const status: ProjectStatus = {
            active: true,
            managed: false,
            pid: procs[0].ProcessId,
          };
          res.json(status);
          return;
        }
      }
    } catch {
      // PowerShell detection failed — fall through to inactive
    }
  }

  const status: ProjectStatus = { active: false, managed: false };
  res.json(status);
});

export default router;
