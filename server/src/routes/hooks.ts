import { Router } from 'express';
import type { HookEventType } from '../../../shared/types.js';
import {
  addEvent,
  getEventsByProjectFiltered,
  getActivitySummary,
} from '../services/hook-event-store.js';
import { broadcast } from '../services/websocket.js';

const VALID_EVENT_TYPES: HookEventType[] = [
  'sessionStart',
  'sessionEnd',
  'userPromptSubmitted',
  'preToolUse',
  'postToolUse',
  'errorOccurred',
];

const router = Router();

// POST /api/hooks/event — receive hook callbacks from PowerShell scripts
router.post('/event', async (req, res) => {
  try {
    const { eventType, projectPath, data } = req.body;

    if (!eventType || !projectPath) {
      res.status(400).json({ error: 'eventType and projectPath are required' });
      return;
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      res.status(400).json({ error: `Invalid eventType: ${eventType}` });
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

    res.json({ ok: true, eventId: event.id });
  } catch (err) {
    console.error('[hooks] Failed to process event:', err);
    res.status(500).json({ error: 'Failed to process hook event' });
  }
});

// GET /api/hooks/events/:projectId — recent events for a project
router.get('/events/:projectId', (req, res) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 1000);
  const eventType = req.query.eventType as HookEventType | undefined;

  const events = getEventsByProjectFiltered(projectId, eventType, limit);
  res.json(events);
});

// GET /api/hooks/events/:projectId/activity — summary/timeline view
router.get('/events/:projectId/activity', (req, res) => {
  const { projectId } = req.params;
  const summary = getActivitySummary(projectId);
  res.json(summary);
});

export default router;
