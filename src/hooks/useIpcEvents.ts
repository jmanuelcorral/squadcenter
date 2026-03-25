import { useState, useEffect, useCallback, useRef } from 'react';

interface IpcMessage {
  type: string;
  payload: unknown;
}

export function useIpcEvents() {
  const [messages, setMessages] = useState<IpcMessage[]>([]);
  const [connected] = useState(true); // Always connected in Electron
  const cleanupFns = useRef<Array<() => void>>([]);

  useEffect(() => {
    const eventTypes = [
      'event:project-updated',
      'event:notification',
      'event:session:output',
      'event:session:status',
      'event:hook:event',
    ];

    eventTypes.forEach((channel) => {
      const cleanup = window.electronAPI.on(channel, (payload: unknown) => {
        const type = channel.replace('event:', '');
        setMessages((prev) => [...prev, { type, payload }]);
      });
      cleanupFns.current.push(cleanup);
    });

    return () => {
      cleanupFns.current.forEach((fn) => fn());
      cleanupFns.current = [];
    };
  }, []);

  const send = useCallback((type: string, payload: unknown) => {
    // In Electron, "sending" from renderer to main is done via invoke
    window.electronAPI.invoke(type, payload);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, send, clearMessages };
}
