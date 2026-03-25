export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  team?: TeamMember[];
  status: 'active' | 'archived';
}

export interface TeamMember {
  name: string;
  role: string;
  emoji: string;
  status: 'idle' | 'working' | 'done';
  currentTask?: string;
}

export interface Notification {
  id: string;
  projectId: string;
  agentName: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  agentName?: string;
  content: string;
  timestamp: string;
}

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
  pid?: number;
  sessionId?: string;
  hookDetected?: boolean;
}

export type HookEventType =
  | 'sessionStart'
  | 'sessionEnd'
  | 'userPromptSubmitted'
  | 'preToolUse'
  | 'postToolUse'
  | 'errorOccurred';

export interface HookEvent {
  id: string;
  projectId: string;
  projectPath: string;
  eventType: HookEventType;
  timestamp: string;
  data: Record<string, any>;
}
