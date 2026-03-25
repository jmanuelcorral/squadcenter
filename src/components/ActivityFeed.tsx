import type { ChatMessage } from '@shared/types';

function timeFormat(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const roleColors: Record<string, string> = {
  user: 'bg-blue-500',
  agent: 'bg-violet-500',
  system: 'bg-slate-600',
};

interface Props {
  messages: ChatMessage[];
  loading?: boolean;
}

function SkeletonMessage() {
  return (
    <div className="flex items-start gap-3 animate-pulse">
      <div className="h-8 w-8 rounded-full bg-slate-700/60" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-slate-700/60" />
        <div className="h-3 w-full rounded bg-slate-700/40" />
        <div className="h-3 w-3/4 rounded bg-slate-700/40" />
      </div>
    </div>
  );
}

export default function ActivityFeed({ messages, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <SkeletonMessage />
        <SkeletonMessage />
        <SkeletonMessage />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <div className="text-4xl mb-3">💬</div>
        <p className="text-sm">No activity yet</p>
        <p className="text-xs text-slate-600 mt-1">Orchestration logs will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-4">
      {messages.map((msg) => {
        if (msg.role === 'system') {
          return (
            <div key={msg.id} className="flex justify-center py-2">
              <span className="text-[11px] text-slate-500 bg-slate-800/50 rounded-full px-3 py-1">
                {msg.content}
              </span>
            </div>
          );
        }

        return (
          <div key={msg.id} className="flex items-start gap-3 py-2 rounded-lg hover:bg-white/[0.02] px-2 transition-colors">
            {/* Avatar */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${roleColors[msg.role] || 'bg-slate-600'}`}>
              {msg.agentName ? msg.agentName.charAt(0).toUpperCase() : msg.role === 'user' ? 'U' : '•'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-white">
                  {msg.agentName || (msg.role === 'user' ? 'You' : 'System')}
                </span>
                <span className="text-[10px] text-slate-500">{timeFormat(msg.timestamp)}</span>
              </div>
              <p className="text-sm text-slate-300 mt-0.5 whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
