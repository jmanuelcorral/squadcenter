import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Square, Circle, Loader2, PanelRightOpen, PanelRightClose, Sparkles, RotateCcw, Terminal } from 'lucide-react';
import { getSession, stopSession, sendSessionInput, startCopilotSession, checkHooksConfigured, restartCopilotSession, fetchProject } from '../lib/api';
import type { Session, SessionMessage, HooksValidation, CopilotConfig } from '../lib/api';
import { useIpcEvents } from '../hooks/useIpcEvents';
import SessionTerminal from '../components/SessionTerminal';
import ChatInput from '../components/ChatInput';
import ActivityTimeline from '../components/ActivityTimeline';
import SessionStatsPanel from '../components/SessionStatsPanel';
import SidebarTeamPanel from '../components/SidebarTeamPanel';
import McpServersPanel from '../components/McpServersPanel';
import SetupHooksButton from '../components/SetupHooksButton';

import AzureAccountPanel from '../components/AzureAccountPanel';

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
  const [restarting, setRestarting] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [hooksStatus, setHooksStatus] = useState<HooksValidation | null>(null);
  const [copilotConfig, setCopilotConfig] = useState<CopilotConfig | null>(null);
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

  // Validate hooks configuration for this project
  useEffect(() => {
    if (!session?.projectPath) return;
    checkHooksConfigured(session.projectPath)
      .then((result) => setHooksStatus(result))
      .catch(() => setHooksStatus({ configured: false, hasHooksJson: false, hasSessionEnd: false, hasPostToolUse: false, hasSessionStart: false, hasScripts: false, missing: ['validation failed'] }));
  }, [session?.projectPath]);

  // Load project config for terminal font settings
  useEffect(() => {
    if (!session?.projectId) return;
    fetchProject(session.projectId)
      .then((project) => setCopilotConfig(project.copilotConfig ?? null))
      .catch(() => {});
  }, [session?.projectId]);

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

  const handleRestart = useCallback(async () => {
    if (!id || !session) return;
    setRestarting(true);
    try {
      const newSession = await restartCopilotSession(id, session.projectId, session.projectPath);
      navigate(`/sessions/${newSession.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to restart session:', err);
    } finally {
      setRestarting(false);
    }
  }, [id, session, navigate]);

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
  const isShell = session.type === 'shell';
  const usePtyMode = (isCopilot || isShell) && isActive;
  const statusClass = statusColors[session.status] ?? statusColors.stopped;

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      {/* Header */}
      <header className={`flex items-center justify-between border-b bg-slate-900/80 backdrop-blur px-5 py-3 ${isCopilot ? 'border-violet-500/20' : isShell ? 'border-slate-500/20' : 'border-white/5'}`}>
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
              {isShell && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-slate-500/15 to-slate-600/15 px-2 py-0.5 text-[10px] font-semibold text-slate-300 ring-1 ring-slate-500/25">
                  <Terminal className="w-3 h-3" />
                  Shell
                </span>
              )}
              <h1 className="text-sm font-semibold text-white truncate max-w-xs">
                {session.projectPath.split(/[/\\]/).pop() ?? 'Session'}
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusClass}`}>
                {session.status === 'active' && (
                  <Circle className={`w-1.5 h-1.5 fill-current animate-pulse-dot ${isCopilot ? 'text-violet-400' : isShell ? 'text-slate-400' : 'text-emerald-400'}`} />
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
            <>
              {/* Restart button */}
              {(isCopilot || isShell) && (
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                  title="Restart session"
                >
                  {restarting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Restart
                </button>
              )}

              {/* Stop button */}
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
            </>
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
              fontFamily={copilotConfig?.terminalFontFamily}
              fontSize={copilotConfig?.terminalFontSize}
            />
          ) : (
            <SessionTerminal
              messages={messages}
              thinking={isCopilot && thinking}
              fontFamily={copilotConfig?.terminalFontFamily}
              fontSize={copilotConfig?.terminalFontSize}
            />
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

        {/* Right: Stats + Team + Activity Timeline (collapsible) */}
        {showActivity && session.projectId && (
          <div className="hidden md:flex w-80 flex-col border-l border-white/5 bg-slate-900/60 overflow-y-auto">
            {/* Session Stats */}
            <SessionStatsPanel sessionId={session.id} />

            {/* Team + Agent Activity (merged) */}
            <SidebarTeamPanel projectId={session.projectId} sessionId={session.id} compact />

            {/* MCP Servers */}
            <McpServersPanel sessionId={session.id} />

            {/* Azure Account */}
            <AzureAccountPanel sessionId={session.id} />

            {/* Hooks / Copilot Activity */}
            {hooksStatus && !hooksStatus.configured && (
              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  <h2 className="text-xs font-semibold text-slate-400">Copilot Hooks</h2>
                </div>
                <p className="text-[10px] text-slate-500 mb-1">
                  Configura los hooks para recibir notificaciones automáticas cuando Copilot termine de trabajar.
                </p>
                {hooksStatus.missing.length > 0 && (
                  <p className="text-[10px] text-amber-400/70 mb-2">
                    Faltan: {hooksStatus.missing.join(', ')}
                  </p>
                )}
                <SetupHooksButton projectId={session.projectId} onSetup={() => {
                  if (session?.projectPath) {
                    checkHooksConfigured(session.projectPath).then(setHooksStatus);
                  }
                }} />
              </div>
            )}

            {hooksStatus?.configured && (
              <div className="px-4 py-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <h2 className="text-xs font-semibold text-slate-300">Hooks Activos</h2>
                  <span className="text-[10px] text-emerald-400/60 ml-auto">Monitorizando</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
