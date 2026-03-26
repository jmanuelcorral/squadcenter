import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';

export interface McpServer {
  name: string;
  type: string; // "stdio" | "sse" | "unknown"
  command?: string;
  args?: string[];
  url?: string;
}

export interface AzureAccount {
  user: string;
  tenantId: string;
  tenantName?: string;
  subscriptionId?: string;
  subscriptionName?: string;
  state?: string;        // "Enabled", "Disabled", etc.
  cloudName?: string;    // "AzureCloud", "AzureUSGovernment", etc.
}

export async function detectMcpServers(projectPath: string): Promise<McpServer[]> {
  const servers: McpServer[] = [];

  const configPaths = [
    path.join(projectPath, '.copilot', 'mcp.json'),
    path.join(projectPath, '.copilot', 'mcp-config.json'),
    path.join(projectPath, '.vscode', 'mcp.json'),
    path.join(projectPath, '.vscode', 'settings.json'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.copilot', 'mcp.json'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.copilot', 'mcp-config.json'),
    path.join(process.env.APPDATA || '', 'github-copilot', 'mcp.json'),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      const serversObj = config.servers || config.mcpServers || config.mcp?.servers || config.mcp?.mcpServers || {};

      for (const [name, serverConfig] of Object.entries(serversObj)) {
        const sc = serverConfig as Record<string, unknown>;
        servers.push({
          name,
          type: (sc.type as string) || (sc.command ? 'stdio' : sc.url ? 'sse' : 'unknown'),
          command: sc.command as string | undefined,
          args: sc.args as string[] | undefined,
          url: sc.url as string | undefined,
        });
      }
    } catch {
      // File doesn't exist or isn't valid JSON — skip
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return servers.filter(s => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });
}

export async function detectAzureAccount(): Promise<AzureAccount | null> {
  return new Promise((resolve) => {
    execFile('az', ['account', 'show', '--output', 'json'], { timeout: 5000, shell: true }, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }
      try {
        const account = JSON.parse(stdout);
        resolve({
          user: account.user?.name || 'Unknown',
          tenantId: account.tenantId || '',
          tenantName: account.tenantDisplayName || '',
          subscriptionId: account.id || '',
          subscriptionName: account.name || '',
          state: account.state || '',
          cloudName: account.environmentName || '',
        });
      } catch {
        resolve(null);
      }
    });
  });
}
