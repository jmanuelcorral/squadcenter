import { useState, useEffect } from 'react';
import { Plug } from 'lucide-react';
import { getMcpServers } from '../lib/api';
import type { McpServer } from '../lib/api';
import CollapsiblePanel from './CollapsiblePanel';

interface McpServersPanelProps {
  sessionId: string;
}

const typeBadgeStyles: Record<string, string> = {
  stdio:   'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25',
  sse:     'bg-green-500/15 text-green-300 ring-1 ring-green-500/25',
  unknown: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25',
};

export default function McpServersPanel({ sessionId }: McpServersPanelProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    getMcpServers(sessionId)
      .then((data) => setServers(data ?? []))
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <CollapsiblePanel
      title="MCP Servers"
      icon={<Plug className="w-3.5 h-3.5" />}
      defaultOpen={false}
      badge={
        !loading && servers.length > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 ring-1 ring-white/10">
            {servers.length}
          </span>
        ) : undefined
      }
    >
      <div className="px-4 pb-3">
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
                <div key={server.name} className="py-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200 truncate">{server.name}</span>
                    <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}>
                      {server.type}
                    </span>
                  </div>
                  {server.command && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {server.command} {server.args?.find(a => a.startsWith('@') || !a.startsWith('-')) ?? ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
}
