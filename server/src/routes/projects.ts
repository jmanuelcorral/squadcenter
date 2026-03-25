import { Router } from 'express';
import crypto from 'crypto';
import type { Project } from '../../../shared/types.js';
import { loadProjects, saveProjects } from '../services/storage.js';
import { readTeamFile } from '../services/squad-reader.js';
import { broadcast } from '../services/websocket.js';

const router = Router();

// GET /api/projects — List all active projects
router.get('/', async (_req, res) => {
  try {
    const projects = await loadProjects();
    const active = projects.filter(p => p.status !== 'archived');
    res.json(active);
  } catch (err) {
    console.error('Failed to load projects:', err);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

// POST /api/projects — Create a new project
router.post('/', async (req, res) => {
  try {
    const { name, path: projectPath, description } = req.body;

    if (!name || !projectPath) {
      res.status(400).json({ error: 'name and path are required' });
      return;
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      path: projectPath,
      description: description || '',
      createdAt: now,
      updatedAt: now,
      team: [],
      status: 'active',
    };

    const projects = await loadProjects();
    projects.push(project);
    await saveProjects(projects);

    broadcast('project-updated', project);
    res.status(201).json(project);
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:id — Get single project
router.get('/:id', async (req, res) => {
  try {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === req.params.id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (err) {
    console.error('Failed to get project:', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// PUT /api/projects/:id — Update project
router.put('/:id', async (req, res) => {
  try {
    const projects = await loadProjects();
    const index = projects.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const updated: Project = {
      ...projects[index],
      ...req.body,
      id: projects[index].id,
      createdAt: projects[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    projects[index] = updated;
    await saveProjects(projects);

    broadcast('project-updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('Failed to update project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id — Soft delete (archive)
router.delete('/:id', async (req, res) => {
  try {
    const projects = await loadProjects();
    const index = projects.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    projects[index].status = 'archived';
    projects[index].updatedAt = new Date().toISOString();
    await saveProjects(projects);

    broadcast('project-updated', projects[index]);
    res.json({ message: 'Project archived' });
  } catch (err) {
    console.error('Failed to delete project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/projects/:id/import — Import team from .squad/team.md
router.post('/:id/import', async (req, res) => {
  try {
    const projects = await loadProjects();
    const index = projects.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const team = await readTeamFile(projects[index].path);
    projects[index].team = team;
    projects[index].updatedAt = new Date().toISOString();
    await saveProjects(projects);

    broadcast('project-updated', projects[index]);
    res.json(projects[index]);
  } catch (err) {
    console.error('Failed to import project:', err);
    res.status(500).json({ error: 'Failed to import team data' });
  }
});

export default router;
