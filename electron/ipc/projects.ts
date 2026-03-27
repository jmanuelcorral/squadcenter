import type { IpcMain } from 'electron';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Project } from '../../shared/types.js';
import { loadProjects, saveProjects } from '../services/storage.js';
import { readTeamFile, readDecisions, readOrchestrationLogs, readAgentDetails } from '../services/squad-reader.js';
import { broadcast } from '../services/event-bridge.js';
import { generateHooksConfig } from '../services/hooks-generator.js';
import { validateProjectHooks } from '../services/hook-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findSessionByProject } from '../services/session-manager.js';
import { hasActiveHookSession, isRecentlyWorking } from '../services/hook-event-store.js';
import type { ProjectStatus } from '../../shared/types.js';

const execAsync = promisify(exec);

export function registerProjectHandlers(ipcMain: IpcMain): void {
  // projects:list — List all active projects
  ipcMain.handle('projects:list', async () => {
    const projects = await loadProjects();
    return projects.filter(p => p.status !== 'archived');
  });

  // projects:get — Get single project
  ipcMain.handle('projects:get', async (_event, { id }: { id: string }) => {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return project;
  });

  // projects:create — Create a new project
  ipcMain.handle('projects:create', async (_event, { name, path: projectPath, description }: { name: string; path: string; description?: string }) => {
    if (!name || !projectPath) throw new Error('name and path are required');

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
    return project;
  });

  // projects:delete — Soft delete (archive)
  ipcMain.handle('projects:delete', async (_event, { id }: { id: string }) => {
    const projects = await loadProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');

    projects[index].status = 'archived';
    projects[index].updatedAt = new Date().toISOString();
    await saveProjects(projects);

    broadcast('project-updated', projects[index]);
  });

  // projects:update — Update project fields (name, description, copilotConfig)
  ipcMain.handle('projects:update', async (_event, { id, updates }: { id: string; updates: Partial<Pick<Project, 'name' | 'description' | 'copilotConfig'>> }) => {
    const projects = await loadProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');

    if (updates.name !== undefined) projects[index].name = updates.name;
    if (updates.description !== undefined) projects[index].description = updates.description;
    if (updates.copilotConfig !== undefined) projects[index].copilotConfig = updates.copilotConfig;
    projects[index].updatedAt = new Date().toISOString();

    await saveProjects(projects);
    broadcast('project-updated', projects[index]);
    return projects[index];
  });

  // projects:import — Import a project from a filesystem path
  ipcMain.handle('projects:import', async (_event, { path: projectPath }: { path: string }) => {
    if (!projectPath) throw new Error('path is required');

    const resolvedPath = path.resolve(projectPath);

    // Verify .squad/ folder exists
    const squadDir = path.join(resolvedPath, '.squad');
    try {
      await fs.access(squadDir);
    } catch {
      throw new Error('.squad/ folder not found at the given path');
    }

    // Try to parse project name from team.md
    let projectName = path.basename(resolvedPath);
    try {
      const teamMd = await fs.readFile(path.join(squadDir, 'team.md'), 'utf-8');
      const quoteLine = teamMd.split('\n').find(line => line.trim().startsWith('> '));
      if (quoteLine) {
        const parsed = quoteLine.replace(/^>\s*/, '').trim();
        if (parsed) projectName = parsed;
      }
    } catch {
      // team.md not found or unreadable — use folder name
    }

    const team = await readTeamFile(resolvedPath);

    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name: projectName,
      path: resolvedPath,
      description: '',
      createdAt: now,
      updatedAt: now,
      team,
      status: 'active',
    };

    const projects = await loadProjects();
    projects.push(project);
    await saveProjects(projects);

    broadcast('project-updated', project);
    return project;
  });

  // projects:team — Get team members
  ipcMain.handle('projects:team', async (_event, { id }: { id: string }) => {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return readTeamFile(project.path);
  });

  // projects:decisions — Get decisions
  ipcMain.handle('projects:decisions', async (_event, { id }: { id: string }) => {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return readDecisions(project.path);
  });

  // projects:logs — Get orchestration logs
  ipcMain.handle('projects:logs', async (_event, { id }: { id: string }) => {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return readOrchestrationLogs(project.path);
  });

  // projects:agent — Get agent details
  ipcMain.handle('projects:agent', async (_event, { id, agentName }: { id: string; agentName: string }) => {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');
    return readAgentDetails(project.path, agentName);
  });

  // projects:status — Detect if copilot is running for a project
  ipcMain.handle('projects:status', async (_event, { projectId }: { projectId: string }) => {
    // Check managed sessions first
    const managedSession = findSessionByProject(projectId);
    if (managedSession) {
      const status: ProjectStatus = {
        active: true,
        managed: true,
        working: isRecentlyWorking(projectId),
        pid: managedSession.pid,
        sessionId: managedSession.id,
        sessionType: managedSession.type,
      };
      return status;
    }

    // Check hook-based session detection
    if (hasActiveHookSession(projectId)) {
      const status: ProjectStatus = {
        active: true,
        managed: false,
        working: isRecentlyWorking(projectId),
        hookDetected: true,
      };
      return status;
    }

    const status: ProjectStatus = { active: false, managed: false };
    return status;
  });

  // projects:setupHooks — Generate Copilot CLI hooks config
  ipcMain.handle('projects:setupHooks', async (_event, { id }: { id: string }) => {
    const projects = await loadProjects();
    const project = projects.find(p => p.id === id);
    if (!project) throw new Error('Project not found');

    const serverUrl = 'http://localhost:3001';
    await generateHooksConfig(project.path, serverUrl);
    return { success: true };
  });

  // projects:checkHooks — Validate hooks are properly configured in the project
  ipcMain.handle('projects:checkHooks', async (_event, { projectPath }: { projectPath: string }) => {
    return validateProjectHooks(projectPath);
  });
}
