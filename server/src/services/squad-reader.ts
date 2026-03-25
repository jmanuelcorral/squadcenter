import fs from 'fs/promises';
import path from 'path';
import type { TeamMember } from '../../../shared/types.js';

interface DecisionEntry {
  date: string;
  title: string;
  content: string;
}

interface LogEntry {
  filename: string;
  content: string;
}

interface AgentDetails {
  name: string;
  charter: string | null;
  history: string | null;
}

function parseTeamTable(markdown: string): TeamMember[] {
  const lines = markdown.split('\n');
  const members: TeamMember[] = [];

  // Find the Members table — look for the header row with Name | Role | Charter | Status
  let inMembersTable = false;
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('## Members')) {
      inMembersTable = true;
      headerPassed = false;
      continue;
    }

    // Stop at next heading
    if (inMembersTable && trimmed.startsWith('## ') && !trimmed.includes('## Members')) {
      break;
    }

    if (!inMembersTable) continue;

    // Skip header row
    if (trimmed.startsWith('| Name')) {
      headerPassed = false;
      continue;
    }

    // Skip separator row
    if (trimmed.startsWith('|---') || trimmed.startsWith('| ---')) {
      headerPassed = true;
      continue;
    }

    // Parse data rows
    if (headerPassed && trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 4) {
        const name = cells[0];
        const role = cells[1];
        const statusText = cells[3];

        // Extract emoji from status text
        const emojiMatch = statusText.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
        const emoji = emojiMatch ? emojiMatch[0] : '👤';

        // Map status text to our status enum
        let status: TeamMember['status'] = 'idle';
        const lower = statusText.toLowerCase();
        if (lower.includes('active') || lower.includes('working') || lower.includes('monitor')) {
          status = 'working';
        } else if (lower.includes('done') || lower.includes('complete')) {
          status = 'done';
        }

        members.push({ name, role, emoji, status });
      }
    }
  }

  return members;
}

export async function readTeamFile(projectPath: string): Promise<TeamMember[]> {
  try {
    const teamPath = path.join(projectPath, '.squad', 'team.md');
    const content = await fs.readFile(teamPath, 'utf-8');
    return parseTeamTable(content);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function readDecisions(projectPath: string): Promise<DecisionEntry[]> {
  try {
    const decisionsPath = path.join(projectPath, '.squad', 'decisions.md');
    const content = await fs.readFile(decisionsPath, 'utf-8');

    const entries: DecisionEntry[] = [];
    const sections = content.split(/^## /m).filter(s => s.trim());

    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0]?.trim() || 'Untitled';

      // Try to extract date from content
      const dateMatch = section.match(/\d{4}-\d{2}-\d{2}/);
      const date = dateMatch ? dateMatch[0] : '';

      entries.push({
        date,
        title,
        content: lines.slice(1).join('\n').trim(),
      });
    }

    return entries;
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function readOrchestrationLogs(projectPath: string): Promise<LogEntry[]> {
  try {
    const logsDir = path.join(projectPath, '.squad', 'orchestration-log');
    const files = await fs.readdir(logsDir);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();

    const entries: LogEntry[] = [];
    for (const filename of mdFiles) {
      const content = await fs.readFile(path.join(logsDir, filename), 'utf-8');
      entries.push({ filename, content });
    }

    return entries;
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function readAgentDetails(projectPath: string, agentName: string): Promise<AgentDetails> {
  const agentDir = path.join(projectPath, '.squad', 'agents', agentName.toLowerCase());

  let charter: string | null = null;
  let history: string | null = null;

  try {
    charter = await fs.readFile(path.join(agentDir, 'charter.md'), 'utf-8');
  } catch {
    // charter not found
  }

  try {
    history = await fs.readFile(path.join(agentDir, 'history.md'), 'utf-8');
  } catch {
    // history not found
  }

  return { name: agentName, charter, history };
}
