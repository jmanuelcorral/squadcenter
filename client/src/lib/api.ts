import type { Project, TeamMember, Notification, ChatMessage } from '@shared/types';

export type { Project, TeamMember, Notification, ChatMessage };

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
