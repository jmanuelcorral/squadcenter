import type { Project, TeamMember, Notification, ChatMessage } from '@shared/types';

export type { Project, TeamMember, Notification, ChatMessage };

// Session types (contract with backend — Morpheus adding to shared/types.ts)
export interface Session {
  id: string;
  projectId: string;
  projectPath: string;
  status: 'starting' | 'active' | 'stopped' | 'error';
  type?: 'shell' | 'copilot';
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
  sessionType?: 'shell' | 'copilot';
  hookDetected?: boolean;
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

// Session Stats (token consumption + premium requests + session activity)
export interface SessionStats {
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  premiumRequests: number;
  turns: number;
  toolCalls: number;
  lastUpdated: string;
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

// ── IPC-backed API functions ───────────────────────────────────────────

// Projects
export function fetchProjects(): Promise<Project[]> {
  return window.electronAPI.invoke('projects:list');
}

export function fetchProject(id: string): Promise<Project> {
  return window.electronAPI.invoke('projects:get', { id });
}

export function createProject(data: { name: string; path: string; description?: string }): Promise<Project> {
  return window.electronAPI.invoke('projects:create', data);
}

export function deleteProject(id: string): Promise<void> {
  return window.electronAPI.invoke('projects:delete', { id });
}

export function importProject(path: string): Promise<Project> {
  return window.electronAPI.invoke('projects:import', { path });
}

// Team
export function fetchTeam(projectId: string): Promise<TeamMember[]> {
  return window.electronAPI.invoke('projects:team', { id: projectId });
}

// Activity & Logs
export function fetchDecisions(projectId: string): Promise<ChatMessage[]> {
  return window.electronAPI.invoke('projects:decisions', { id: projectId });
}

export function fetchLogs(projectId: string): Promise<ChatMessage[]> {
  return window.electronAPI.invoke('projects:logs', { id: projectId });
}

export function fetchAgentDetails(projectId: string, agentName: string): Promise<{ charter: string; history: string }> {
  return window.electronAPI.invoke('projects:agent', { id: projectId, agentName });
}

// Filesystem browsing
export function browseFolders(path?: string): Promise<BrowseResult> {
  return window.electronAPI.invoke('filesystem:browse', { path });
}

// Notifications
export function fetchNotifications(): Promise<Notification[]> {
  return window.electronAPI.invoke('notifications:list');
}

export function markNotificationRead(id: string): Promise<void> {
  return window.electronAPI.invoke('notifications:markRead', { id });
}

export function clearNotifications(): Promise<void> {
  return window.electronAPI.invoke('notifications:clear');
}

// Sessions
export function getSessions(): Promise<Session[]> {
  return window.electronAPI.invoke('sessions:list');
}

export function getSession(id: string): Promise<Session & { messages: SessionMessage[] }> {
  return window.electronAPI.invoke('sessions:get', { id });
}

export function startSession(projectId: string, projectPath: string): Promise<Session> {
  return window.electronAPI.invoke('sessions:create', { projectId, projectPath });
}

export function startCopilotSession(projectId: string, projectPath: string): Promise<Session> {
  return window.electronAPI.invoke('sessions:create', { projectId, projectPath, type: 'copilot' });
}

export function stopSession(id: string): Promise<{ success: true }> {
  return window.electronAPI.invoke('sessions:stop', { id });
}

export function sendSessionInput(id: string, text: string): Promise<{ success: true }> {
  return window.electronAPI.invoke('sessions:sendInput', { id, text });
}

export function getProjectStatus(projectId: string): Promise<ProjectStatus> {
  return window.electronAPI.invoke('projects:status', { projectId });
}

// Hook Events
export function getHookEvents(projectId: string, limit?: number): Promise<HookEvent[]> {
  return window.electronAPI.invoke('hooks:getEvents', { projectId, limit });
}

export function getHookActivitySummary(projectId: string): Promise<Record<string, any>> {
  return window.electronAPI.invoke('hooks:getActivity', { projectId });
}

export function resizeSession(id: string, cols: number, rows: number): Promise<{ ok: boolean }> {
  return window.electronAPI.invoke('sessions:resize', { id, cols, rows });
}

export function setupProjectHooks(projectId: string): Promise<{ success: boolean; hooksPath: string }> {
  return window.electronAPI.invoke('projects:setupHooks', { id: projectId });
}

// Agent Activity (real-time tool calls & subagent tracking)
export interface AgentToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: string;
  model?: string;
}

export interface SubagentSpawn {
  id: string;
  name: string;
  description: string;
  agentType: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: string;
}

export interface MemberActivity {
  name: string;
  status: 'idle' | 'working' | 'done';
  subagents: SubagentSpawn[];
  toolCalls: AgentToolCall[];
  lastActiveAt?: string;
}

export interface AgentActivity {
  isActive: boolean;
  currentTurnStart?: string;
  agentName?: string;
  toolCalls: AgentToolCall[];
  subagents: SubagentSpawn[];
  members: Record<string, MemberActivity>;
  lastUpdated: string;
}

export function getAgentActivity(sessionId: string): Promise<AgentActivity | null> {
  return window.electronAPI.invoke('sessions:getAgentActivity', { id: sessionId });
}

export function refreshAgentActivity(sessionId: string): Promise<AgentActivity | null> {
  return window.electronAPI.invoke('sessions:refreshAgentActivity', { id: sessionId });
}

// MCP Servers
export interface McpServer {
  name: string;
  type: string;
  command?: string;
  args?: string[];
  url?: string;
}

export function getMcpServers(sessionId: string): Promise<McpServer[]> {
  return window.electronAPI.invoke('sessions:getMcpServers', { sessionId });
}

// Azure Account
export interface AzureAccount {
  user: string;
  tenantId: string;
  tenantName?: string;
  subscriptionId?: string;
  subscriptionName?: string;
  state?: string;
  cloudName?: string;
}

export function getAzureAccount(sessionId: string): Promise<AzureAccount | null> {
  return window.electronAPI.invoke('sessions:getAzureAccount', { sessionId });
}

// Session Stats
export function getSessionStats(id: string): Promise<SessionStats | null> {
  return window.electronAPI.invoke('sessions:getStats', { id });
}

export function refreshSessionStats(id: string): Promise<SessionStats | null> {
  return window.electronAPI.invoke('sessions:refreshStats', { id });
}
