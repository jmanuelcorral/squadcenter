import { useState, useEffect } from 'react';
import { Plug } from 'lucide-react';
import { getMcpServers } from '../lib/api';
import type { McpServer } from '../lib/api';

interface McpServersPanelProps {
  projectPath: string;
}

const typeBadgeStyles: Record<string, string> = {
  stdio:   'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25',
  sse:     'bg-green-500/15 text-green-300 ring-1 ring-green-500/25',
  unknown: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25',
};

export default function McpServersPanel({ projectPath }: McpServersPanelProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectPath) return;
    setLoading(true);
    getMcpServers(projectPath)
      .then((data) => setServers(data ?? []))
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  }, [projectPath]);

  return (
    <div className="border-b border-white/5 px-4 py-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Plug className="w-3.5 h-3.5 text-slate-400" />
        <h2 className="text-xs font-semibold text-slate-300">MCP Servers</h2>
        {!loading && servers.length > 0 && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-white/10">
            {servers.length}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-5 rounded bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic">No MCP servers configured</p>
      ) : (
        <div className="space-y-1">
          {servers.map((server) => {
            const badgeClass = typeBadgeStyles[server.type] ?? typeBadgeStyles.unknown;
            return (
              <div key={server.name} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs font-medium text-slate-200 truncate">{server.name}</span>
                <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}>
                  {server.type}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
