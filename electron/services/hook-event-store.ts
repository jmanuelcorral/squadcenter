import crypto from 'crypto';
import type { HookEvent, HookEventType } from '../../shared/types.js';
import { loadProjects } from './storage.js';

const MAX_EVENTS_PER_PROJECT = 1000;

const eventStore = new Map<string, HookEvent[]>();

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

export async function resolveProjectId(projectPath: string): Promise<string | null> {
  const projects = await loadProjects();
  const norm = normalizePath(projectPath);
  const found = projects.find(p => normalizePath(p.path) === norm);
  return found?.id ?? null;
}

export async function addEvent(
  projectPath: string,
  eventType: HookEventType,
  data: Record<string, any>,
): Promise<HookEvent> {
  const projectId = (await resolveProjectId(projectPath)) ?? 'unknown';
  const norm = normalizePath(projectPath);

  const event: HookEvent = {
    id: crypto.randomUUID(),
    projectId,
    projectPath,
    eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  let events = eventStore.get(norm);
  if (!events) {
    events = [];
    eventStore.set(norm, events);
  }

  events.push(event);

  if (events.length > MAX_EVENTS_PER_PROJECT) {
    eventStore.set(norm, events.slice(-MAX_EVENTS_PER_PROJECT));
  }

  return event;
}

export function getEvents(projectPath: string, limit = 50): HookEvent[] {
  const norm = normalizePath(projectPath);
  const events = eventStore.get(norm) ?? [];
  return events.slice(-limit);
}

export function getEventsByProject(projectId: string, limit = 50): HookEvent[] {
  const all: HookEvent[] = [];
  for (const events of eventStore.values()) {
    for (const e of events) {
      if (e.projectId === projectId) all.push(e);
    }
  }
  return all.slice(-limit);
}

export function getEventsByProjectFiltered(
  projectId: string,
  eventType?: HookEventType,
  limit = 50,
): HookEvent[] {
  let events = getEventsByProject(projectId, MAX_EVENTS_PER_PROJECT);
  if (eventType) {
    events = events.filter(e => e.eventType === eventType);
  }
  return events.slice(-limit);
}

export function clearEvents(projectPath: string): void {
  const norm = normalizePath(projectPath);
  eventStore.delete(norm);
}

export function hasActiveHookSession(projectId: string): boolean {
  const events = getEventsByProject(projectId, MAX_EVENTS_PER_PROJECT);
  let active = false;
  for (const e of events) {
    if (e.eventType === 'sessionStart') active = true;
    if (e.eventType === 'sessionEnd') active = false;
  }
  return active;
}

export interface ActivitySummary {
  eventType: HookEventType;
  count: number;
  lastSeen: string;
}

export function getActivitySummary(projectId: string): ActivitySummary[] {
  const events = getEventsByProject(projectId, MAX_EVENTS_PER_PROJECT);
  const map = new Map<HookEventType, { count: number; lastSeen: string }>();

  for (const e of events) {
    const existing = map.get(e.eventType);
    if (!existing) {
      map.set(e.eventType, { count: 1, lastSeen: e.timestamp });
    } else {
      existing.count++;
      if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
    }
  }

  return Array.from(map.entries()).map(([eventType, stats]) => ({
    eventType,
    ...stats,
  }));
}
