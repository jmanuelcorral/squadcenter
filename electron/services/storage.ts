import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import type { Project, Notification } from '../../shared/types.js';

let DATA_DIR = path.join(process.cwd(), 'data');

export function setDataDir(dir: string): void {
  DATA_DIR = dir;
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDataDir(): string {
  return DATA_DIR;
}

function projectsFile(): string {
  return path.join(DATA_DIR, 'projects.json');
}

function notificationsFile(): string {
  return path.join(DATA_DIR, 'notifications.json');
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      await ensureDataDir();
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    throw err;
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadProjects(): Promise<Project[]> {
  return readJsonFile<Project[]>(projectsFile(), []);
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await writeJsonFile(projectsFile(), projects);
}

export async function loadNotifications(): Promise<Notification[]> {
  return readJsonFile<Notification[]>(notificationsFile(), []);
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  await writeJsonFile(notificationsFile(), notifications);
}
