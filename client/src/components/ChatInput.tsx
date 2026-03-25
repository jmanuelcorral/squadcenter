import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setText('');
  }, [text, disabled, onSend]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setText(history[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setText('');
      } else {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setText(history[next]);
      }
    }
  }

  return (
    <div className="border-t border-white/5 bg-[#0d1117] px-4 py-3">
      <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 ring-1 ring-white/10 focus-within:ring-emerald-500/40 transition-all duration-200 px-4 py-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setHistoryIndex(-1); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Session is not active' : 'Type a message or command…'}
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none font-mono disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
