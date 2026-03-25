import { Router } from 'express';
import { loadProjects } from '../services/storage.js';
import {
  readTeamFile,
  readDecisions,
  readOrchestrationLogs,
  readAgentDetails,
} from '../services/squad-reader.js';

const router = Router();

// GET /api/projects/:id/team — Get team members
router.get('/:id/team', async (req, res) => {
  try {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const team = await readTeamFile(project.path);
    res.json(team);
  } catch (err) {
    console.error('Failed to read team:', err);
    res.status(500).json({ error: 'Failed to read team data' });
  }
});

// GET /api/projects/:id/decisions — Get decisions
router.get('/:id/decisions', async (req, res) => {
  try {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const decisions = await readDecisions(project.path);
    res.json(decisions);
  } catch (err) {
    console.error('Failed to read decisions:', err);
    res.status(500).json({ error: 'Failed to read decisions' });
  }
});

// GET /api/projects/:id/logs — Get orchestration logs
router.get('/:id/logs', async (req, res) => {
  try {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const logs = await readOrchestrationLogs(project.path);
    res.json(logs);
  } catch (err) {
    console.error('Failed to read logs:', err);
    res.status(500).json({ error: 'Failed to read orchestration logs' });
  }
});

// GET /api/projects/:id/agent/:agentName — Get agent details
router.get('/:id/agent/:agentName', async (req, res) => {
  try {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const details = await readAgentDetails(project.path, req.params.agentName);
    res.json(details);
  } catch (err) {
    console.error('Failed to read agent details:', err);
    res.status(500).json({ error: 'Failed to read agent details' });
  }
});

export default router;
