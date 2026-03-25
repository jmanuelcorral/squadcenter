import { useEffect, useRef } from 'react';
import type { SessionMessage } from '../lib/api';

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface SessionTerminalProps {
  messages: SessionMessage[];
  loading?: boolean;
}

export default function SessionTerminal({ messages, loading }: SessionTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#0d1117] p-4 font-mono text-sm">
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-3 w-16 bg-slate-800 rounded" />
              <div className="h-3 rounded bg-slate-800" style={{ width: `${40 + (i * 13) % 50}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-[#0d1117] p-4 font-mono text-sm leading-relaxed">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-slate-600 text-lg mb-2">⌨</div>
            <p className="text-slate-600 text-xs">Waiting for output…</p>
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className="group flex gap-3 py-0.5 hover:bg-white/[0.02] rounded px-1 -mx-1">
          <span className="shrink-0 text-slate-600 text-[11px] leading-[1.625rem] select-none">
            {formatTime(msg.timestamp)}
          </span>

          {msg.type === 'input' && (
            <span className="text-emerald-400">
              <span className="text-emerald-600 select-none">{'> '}</span>
              {msg.content}
            </span>
          )}

          {msg.type === 'output' && (
            <span className="text-slate-300 whitespace-pre-wrap break-words">{msg.content}</span>
          )}

          {msg.type === 'system' && (
            <span className="text-amber-400/80 italic">{msg.content}</span>
          )}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
