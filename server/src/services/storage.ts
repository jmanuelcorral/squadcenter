import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Project, Notification } from '../../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

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
  return readJsonFile<Project[]>(PROJECTS_FILE, []);
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await writeJsonFile(PROJECTS_FILE, projects);
}

export async function loadNotifications(): Promise<Notification[]> {
  return readJsonFile<Notification[]>(NOTIFICATIONS_FILE, []);
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  await writeJsonFile(NOTIFICATIONS_FILE, notifications);
}
