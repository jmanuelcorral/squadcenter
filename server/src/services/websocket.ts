import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

type EventType = 'project-updated' | 'notification' | 'agent-status-changed';

interface WsMessage {
  type: EventType;
  payload: unknown;
}

let wss: WebSocketServer;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[ws] Client connected. Total:', wss.clients.size);

    ws.on('close', () => {
      console.log('[ws] Client disconnected. Total:', wss.clients.size);
    });

    ws.on('error', (err) => {
      console.error('[ws] Client error:', err.message);
    });
  });

  console.log('[ws] WebSocket server initialized at /ws');
  return wss;
}

export function broadcast(type: EventType, payload: unknown): void {
  if (!wss) return;

  const message: WsMessage = { type, payload };
  const data = JSON.stringify(message);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
