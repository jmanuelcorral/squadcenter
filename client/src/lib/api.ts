import type { Project, TeamMember, Notification, ChatMessage } from '@shared/types';

export type { Project, TeamMember, Notification, ChatMessage };

// Session types (contract with backend — Morpheus adding to shared/types.ts)
export interface Session {
  id: string;
  projectId: string;
  projectPath: string;
  status: 'starting' | 'active' | 'stopped' | 'error';
  startedAt: string;
  pid?: number;
  lastOutput?: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  type: 'input' | 'output' | 'system';
  content: string;
  timestamp: string;
}

export interface ProjectStatus {
  active: boolean;
  managed: boolean;
  sessionId?: string;
}

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

// Projects
export function fetchProjects(): Promise<Project[]> {
  return request('/projects');
}

export function fetchProject(id: string): Promise<Project> {
  return request(`/projects/${id}`);
}

export function createProject(data: { name: string; path: string; description?: string }): Promise<Project> {
  return request('/projects', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteProject(id: string): Promise<void> {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

export function importProject(path: string): Promise<Project> {
  return request('/projects/import', { method: 'POST', body: JSON.stringify({ path }) });
}

// Team
export function fetchTeam(projectId: string): Promise<TeamMember[]> {
  return request(`/projects/${projectId}/team`);
}

// Activity & Logs
export function fetchDecisions(projectId: string): Promise<ChatMessage[]> {
  return request(`/projects/${projectId}/decisions`);
}

export function fetchLogs(projectId: string): Promise<ChatMessage[]> {
  return request(`/projects/${projectId}/logs`);
}

export function fetchAgentDetails(projectId: string, agentName: string): Promise<{ charter: string; history: string }> {
  return request(`/projects/${projectId}/agents/${agentName}`);
}

// Filesystem browsing
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasSquadFolder: boolean;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

export function browseFolders(path?: string): Promise<BrowseResult> {
  const params = path ? `?path=${encodeURIComponent(path)}` : '';
  return request(`/filesystem/browse${params}`);
}

// Notifications
export function fetchNotifications(): Promise<Notification[]> {
  return request('/notifications');
}

export function markNotificationRead(id: string): Promise<void> {
  return request(`/notifications/${id}/read`, { method: 'POST' });
}

export function clearNotifications(): Promise<void> {
  return request('/notifications/clear', { method: 'POST' });
}

// Sessions
export function getSessions(): Promise<Session[]> {
  return request('/sessions');
}

export function getSession(id: string): Promise<Session & { messages: SessionMessage[] }> {
  return request(`/sessions/${id}`);
}

export function startSession(projectId: string, projectPath: string): Promise<Session> {
  return request('/sessions', { method: 'POST', body: JSON.stringify({ projectId, projectPath }) });
}

export function stopSession(id: string): Promise<{ success: true }> {
  return request(`/sessions/${id}`, { method: 'DELETE' });
}

export function sendSessionInput(id: string, text: string): Promise<{ success: true }> {
  return request(`/sessions/${id}/input`, { method: 'POST', body: JSON.stringify({ text }) });
}

export function getProjectStatus(projectId: string): Promise<ProjectStatus> {
  return request(`/projects/${projectId}/status`);
}

// Hook Events (Copilot CLI hooks monitoring)
export type HookEventType = 'sessionStart' | 'sessionEnd' | 'userPromptSubmitted' | 'preToolUse' | 'postToolUse' | 'errorOccurred';

export interface HookEvent {
  id: string;
  projectId: string;
  projectPath: string;
  eventType: HookEventType;
  timestamp: string;
  data: Record<string, any>;
}

export function getHookEvents(projectId: string, limit?: number): Promise<HookEvent[]> {
  const params = limit ? `?limit=${limit}` : '';
  return request(`/hooks/events/${projectId}${params}`);
}

export function getHookActivitySummary(projectId: string): Promise<Record<string, any>> {
  return request(`/hooks/events/${projectId}/activity`);
}

export function setupProjectHooks(projectId: string): Promise<{ success: boolean; hooksPath: string }> {
  return request(`/projects/${projectId}/setup-hooks`, { method: 'POST' });
}
