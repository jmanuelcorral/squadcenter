import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { SessionMessage } from '../lib/api';
import { resizeSession } from '../lib/api';

// ANSI color codes
const GREEN = '\x1b[38;2;52;211;153m';   // emerald-400
const DIM_GREEN = '\x1b[38;2;16;185;129m'; // emerald-600
const AMBER = '\x1b[38;2;251;191;36m';   // amber-400
const VIOLET = '\x1b[38;2;167;139;250m'; // violet-400
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';

interface SessionTerminalProps {
  // Message mode (existing)
  messages?: SessionMessage[];
  loading?: boolean;
  thinking?: boolean;
  // PTY mode (new)
  sessionId?: string;
  active?: boolean;
  mode?: 'messages' | 'pty';
}

const TERM_THEME = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black: '#0d1117',
  red: '#ff7b72',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#58a6ff',
  magenta: '#a78bfa',
  cyan: '#56d4dd',
  white: '#c9d1d9',
  brightBlack: '#484f58',
  brightRed: '#ffa198',
  brightGreen: '#6ee7b7',
  brightYellow: '#fde68a',
  brightBlue: '#79c0ff',
  brightMagenta: '#c4b5fd',
  brightCyan: '#76e4f7',
  brightWhite: '#f0f6fc',
};

export default function SessionTerminal({
  messages = [],
  loading,
  thinking,
  sessionId,
  active,
  mode = 'messages',
}: SessionTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenCountRef = useRef(0);
  const thinkingLineRef = useRef(false);
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPty = mode === 'pty';

  const clearThinking = useCallback(() => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    if (thinkingLineRef.current && terminalRef.current) {
      terminalRef.current.write('\r\x1b[2K');
      thinkingLineRef.current = false;
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: isPty,
      cursorStyle: 'bar',
      cursorInactiveStyle: isPty ? 'outline' : 'none',
      disableStdin: !isPty,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      letterSpacing: 0,
      theme: {
        ...TERM_THEME,
        // In message mode, hide cursor by matching background
        cursor: isPty ? '#58a6ff' : '#0d1117',
      },
      scrollback: 5000,
      convertEol: !isPty, // PTY handles its own line endings
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* container not ready */ }
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    writtenCountRef.current = 0;

    // Handle resize
    const handleResize = () => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(handleResize);
    });
    resizeObserver.observe(containerRef.current);

    // --- PTY mode setup ---
    let cleanupPtyListener: (() => void) | undefined;
    let cleanupDataListener: ReturnType<typeof term.onData> | undefined;
    let cleanupResizeListener: ReturnType<typeof term.onResize> | undefined;

    if (isPty && sessionId) {
      // Listen for PTY data from backend
      cleanupPtyListener = window.electronAPI.on(
        'event:session:ptyData',
        (payload: { sessionId: string; data: string }) => {
          if (payload.sessionId === sessionId) {
            term.write(payload.data);
          }
        },
      );

      // Forward user keystrokes to backend
      cleanupDataListener = term.onData((data: string) => {
        window.electronAPI.invoke('sessions:sendInput', { id: sessionId, text: data });
      });

      // Forward resize events to backend
      cleanupResizeListener = term.onResize(({ cols, rows }) => {
        resizeSession(sessionId, cols, rows);
      });

      // Send initial size after fit
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          resizeSession(sessionId, term.cols, term.rows);
        } catch { /* ignore */ }
      });

      term.focus();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
      }
      cleanupPtyListener?.();
      cleanupDataListener?.dispose();
      cleanupResizeListener?.dispose();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isPty, sessionId]);

  // PTY mode: handle active→inactive transition
  useEffect(() => {
    if (!isPty) return;
    const term = terminalRef.current;
    if (!term) return;

    if (active === false) {
      term.options.disableStdin = true;
      term.options.cursorBlink = false;
      term.write(`\r\n${DIM}${ITALIC}${AMBER}── Session ended ──${RESET}\r\n`);
    }
  }, [isPty, active]);

  // Message mode: write new messages to terminal
  useEffect(() => {
    if (isPty) return;
    const term = terminalRef.current;
    if (!term) return;

    const newMessages = messages.slice(writtenCountRef.current);
    if (newMessages.length === 0) return;

    clearThinking();

    for (const msg of newMessages) {
      writeMessage(term, msg);
    }

    writtenCountRef.current = messages.length;
  }, [isPty, messages, clearThinking]);

  // Message mode: handle thinking indicator
  useEffect(() => {
    if (isPty) return;
    const term = terminalRef.current;
    if (!term) return;

    if (thinking) {
      let dotCount = 0;
      thinkingLineRef.current = true;

      const renderThinking = () => {
        dotCount = (dotCount + 1) % 4;
        const dots = '.'.repeat(dotCount).padEnd(3, ' ');
        term.write(`\r\x1b[2K${VIOLET}✨ Copilot is thinking${dots}${RESET}`);
      };

      renderThinking();
      thinkingIntervalRef.current = setInterval(renderThinking, 400);
    } else {
      clearThinking();
    }
  }, [isPty, thinking, clearThinking]);

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
    <div
      ref={containerRef}
      className="flex-1 min-h-0 bg-[#0d1117]"
      style={{ padding: '8px 0 0 8px' }}
    />
  );
}

function writeMessage(term: Terminal, msg: SessionMessage): void {
  switch (msg.type) {
    case 'input':
      term.writeln(`${DIM_GREEN}> ${GREEN}${msg.content}${RESET}`);
      break;
    case 'output':
      // Output may contain ANSI codes from Copilot CLI — write as-is
      // Split by newlines and write each line to handle multi-line output
      term.writeln(msg.content);
      break;
    case 'system':
      term.writeln(`${DIM}${ITALIC}${AMBER}${msg.content}${RESET}`);
      break;
  }
}
