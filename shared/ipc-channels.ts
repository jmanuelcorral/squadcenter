/**
 * Type-safe IPC channel definitions.
 * Shared between electron/ (main process) and src/ (renderer process).
 */

// Request-response channels (ipcMain.handle ↔ ipcRenderer.invoke)
export const IPC_CHANNELS = {
  // Projects
  PROJECTS_LIST: 'projects:list',
  PROJECTS_GET: 'projects:get',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_IMPORT: 'projects:import',
  PROJECTS_TEAM: 'projects:team',
  PROJECTS_DECISIONS: 'projects:decisions',
  PROJECTS_LOGS: 'projects:logs',
  PROJECTS_AGENT: 'projects:agent',
  PROJECTS_STATUS: 'projects:status',
  PROJECTS_SETUP_HOOKS: 'projects:setupHooks',

  // Filesystem
  FILESYSTEM_BROWSE: 'filesystem:browse',

  // Notifications
  NOTIFICATIONS_LIST: 'notifications:list',
  NOTIFICATIONS_MARK_READ: 'notifications:markRead',
  NOTIFICATIONS_CLEAR: 'notifications:clear',

  // Sessions
  SESSIONS_LIST: 'sessions:list',
  SESSIONS_GET: 'sessions:get',
  SESSIONS_CREATE: 'sessions:create',
  SESSIONS_STOP: 'sessions:stop',
  SESSIONS_SEND_INPUT: 'sessions:sendInput',
  SESSIONS_GET_OUTPUT: 'sessions:getOutput',

  SESSIONS_RESUME: 'sessions:resume',
  SESSIONS_FORCE_RESUME: 'sessions:forceResume',

  // Hooks
  HOOKS_GET_EVENTS: 'hooks:getEvents',
  HOOKS_GET_ACTIVITY: 'hooks:getActivity',
} as const;

// Event channels (main → renderer via BrowserWindow.webContents.send)
export const IPC_EVENTS = {
  PROJECT_UPDATED: 'event:project-updated',
  NOTIFICATION: 'event:notification',
  AGENT_STATUS_CHANGED: 'event:agent-status-changed',
  SESSION_OUTPUT: 'event:session:output',
  SESSION_STATUS: 'event:session:status',
  SESSION_PTY_DATA: 'event:session:ptyData',
  SESSION_STATS: 'event:session:stats',
  SESSION_AGENT_ACTIVITY: 'event:session:agentActivity',
  HOOK_EVENT: 'event:hook:event',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
export type IpcEvent = typeof IPC_EVENTS[keyof typeof IPC_EVENTS];
