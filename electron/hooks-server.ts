import http from 'http';
import type { HookEventType } from '../shared/types.js';
import { addEvent } from './services/hook-event-store.js';
import { broadcast } from './services/event-bridge.js';

const VALID_EVENT_TYPES: HookEventType[] = [
  'sessionStart',
  'sessionEnd',
  'userPromptSubmitted',
  'preToolUse',
  'postToolUse',
  'errorOccurred',
];

let server: http.Server | null = null;

export function startHooksServer(port = 3001): http.Server {
  server = http.createServer(async (req, res) => {
    // Only handle POST /api/hooks/event
    if (req.method === 'POST' && req.url === '/api/hooks/event') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const { eventType, projectPath, data } = JSON.parse(body);

          if (!eventType || !projectPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'eventType and projectPath are required' }));
            return;
          }

          if (!VALID_EVENT_TYPES.includes(eventType)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Invalid eventType: ${eventType}` }));
            return;
          }

          const event = await addEvent(projectPath, eventType as HookEventType, data ?? {});

          // Broadcast the hook event
          broadcast('hook:event', { projectPath, event });

          // For session lifecycle events, also broadcast session:status
          if (eventType === 'sessionStart' || eventType === 'sessionEnd') {
            broadcast('session:status', {
              projectId: event.projectId,
              projectPath,
              hookDetected: true,
              active: eventType === 'sessionStart',
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, eventId: event.id }));
        } catch (err) {
          console.error('[hooks-server] Failed to process event:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to process hook event' }));
        }
      });
    } else {
      // Ignore all other requests
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(port, () => {
    console.log(`[squadCenter] Hooks HTTP server listening on port ${port}`);
  });

  return server;
}

export function stopHooksServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
