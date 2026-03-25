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
