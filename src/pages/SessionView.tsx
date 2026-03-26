import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Square, Circle, Loader2, PanelRightOpen, PanelRightClose, Sparkles } from 'lucide-react';
import { getSession, stopSession, sendSessionInput } from '../lib/api';
import type { Session, SessionMessage } from '../lib/api';
import { useIpcEvents } from '../hooks/useIpcEvents';
import SessionTerminal from '../components/SessionTerminal';
import ChatInput from '../components/ChatInput';
import ActivityTimeline from '../components/ActivityTimeline';

const statusColors: Record<string, string> = {
  starting: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  active:   'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
  stopped:  'bg-slate-700/50 text-slate-400 ring-slate-600/30',
  error:    'bg-red-500/10 text-red-400 ring-red-500/30',
};

export default function SessionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const { messages: ipcMessages } = useIpcEvents();
  const lastIpcMsgIndexRef = useRef(0);

  // Load session data on mount
  useEffect(() => {
    if (!id) return;
    getSession(id)
      .then((data) => {
        setSession(data);
        setMessages(data.messages ?? []);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Subscribe to IPC events for this session
  useEffect(() => {
    if (!id || ipcMessages.length === 0) return;
    // Only process new messages since last render
    const newMessages = ipcMessages.slice(lastIpcMsgIndexRef.current);
    lastIpcMsgIndexRef.current = ipcMessages.length;

    for (const msg of newMessages) {
      if (msg.type === 'session:output') {
        const payload = msg.payload as { sessionId: string; message?: SessionMessage; content?: string };
        if (payload.sessionId === id) {
          setThinking(false);
          if (payload.message) {
            setMessages((prev) => {
              // Deduplicate by ID
              if (prev.some((m) => m.id === payload.message!.id)) return prev;
              return [...prev, payload.message!];
            });
          } else if (payload.content) {
            const newMsg: SessionMessage = {
              id: `ipc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sessionId: id,
              type: 'output',
              content: payload.content,
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      }

      if (msg.type === 'session:status') {
        const payload = msg.payload as { sessionId: string; status: string };
        if (payload.sessionId === id) {
          setSession((prev) =>
            prev ? { ...prev, status: payload.status as Session['status'] } : prev
          );
        }
      }
    }
  }, [id, ipcMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!id) return;
      // Optimistic UI: add input message immediately
      const optimistic: SessionMessage = {
        id: `opt-${Date.now()}`,
        sessionId: id,
        type: 'input',
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      if (session?.type === 'copilot') {
        setThinking(true);
      }
      try {
        await sendSessionInput(id, text);
      } catch {
        // Could show error toast — for now silently fail
      }
    },
    [id],
  );

  const handleStop = useCallback(async () => {
    if (!id) return;
    setStopping(true);
    try {
      await stopSession(id);
      setSession((prev) => (prev ? { ...prev, status: 'stopped' } : prev));
    } catch {
      // ignore
    } finally {
      setStopping(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-slate-400">Session not found</p>
        <button onClick={() => navigate('/')} className="text-sm text-emerald-400 hover:underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isActive = session.status === 'active' || session.status === 'starting';
  const isCopilot = session.type === 'copilot';
  const usePtyMode = isCopilot && isActive;
  const statusClass = statusColors[session.status] ?? statusColors.stopped;

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      {/* Header */}
      <header className={`flex items-center justify-between border-b bg-slate-900/80 backdrop-blur px-5 py-3 ${isCopilot ? 'border-violet-500/20' : 'border-white/5'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-white/10" />

          <div>
            <div className="flex items-center gap-2">
              {isCopilot && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500/15 to-purple-600/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-violet-500/25">
                  <Sparkles className="w-3 h-3" />
                  Copilot
                </span>
              )}
              <h1 className="text-sm font-semibold text-white truncate max-w-xs">
                {session.projectPath.split(/[/\\]/).pop() ?? 'Session'}
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusClass}`}>
                {session.status === 'active' && (
                  <Circle className={`w-1.5 h-1.5 fill-current animate-pulse-dot ${isCopilot ? 'text-violet-400' : 'text-emerald-400'}`} />
                )}
                {session.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">{session.projectPath}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle activity panel */}
          <button
            onClick={() => setShowActivity((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-white transition-colors"
            title={showActivity ? 'Hide activity panel' : 'Show activity panel'}
          >
            {showActivity ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            Activity
          </button>

          {isActive && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {stopping ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Square className="w-3 h-3" />
              )}
              Stop
            </button>
          )}
        </div>
      </header>

      {/* Main content — split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Terminal + Input */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Terminal */}
          {usePtyMode ? (
            <SessionTerminal
              mode="pty"
              sessionId={session.id}
              active={isActive}
            />
          ) : (
            <SessionTerminal messages={messages} thinking={isCopilot && thinking} />
          )}

          {/* Input — hidden in PTY mode (terminal handles input directly) */}
          {usePtyMode ? (
            <div className="flex items-center justify-center border-t border-white/5 bg-slate-900/60 px-4 py-2">
              <span className="text-[11px] text-slate-500 italic">Terminal is interactive — type directly</span>
            </div>
          ) : (
            <ChatInput
              onSend={handleSend}
              disabled={!isActive || (isCopilot && thinking)}
              placeholder={isCopilot ? (thinking ? 'Copilot is thinking...' : 'Ask Copilot...') : undefined}
            />
          )}
        </div>

        {/* Right: Activity Timeline (collapsible) */}
        {showActivity && session.projectId && (
          <div className="hidden md:flex w-80 flex-col border-l border-white/5 bg-slate-900/60">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
              <h2 className="text-xs font-semibold text-slate-300">Copilot Activity</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ActivityTimeline projectId={session.projectId} compact />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
