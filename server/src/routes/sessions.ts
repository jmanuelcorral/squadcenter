import { Router } from 'express';
import {
  startSession,
  startCopilotSession,
  stopSession,
  sendInput,
  getSession,
  getSessionOutput,
  getSessionMessages,
  listSessions,
} from '../services/session-manager.js';

const router = Router();

// GET /api/sessions — list all sessions
router.get('/', (_req, res) => {
  res.json(listSessions());
});

// GET /api/sessions/:id — get session details + recent messages
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const messages = getSessionMessages(req.params.id);
  res.json({ ...session, messages });
});

// POST /api/sessions — start a new session (shell or copilot via optional `type` field)
router.post('/', (req, res) => {
  const { projectId, projectPath, type } = req.body;
  if (!projectId || !projectPath) {
    res.status(400).json({ error: 'projectId and projectPath are required' });
    return;
  }
  try {
    const session = type === 'copilot'
      ? startCopilotSession(projectId, projectPath)
      : startSession(projectId, projectPath);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Failed to start session:', err);
    res.status(500).json({ error: err.message || 'Failed to start session' });
  }
});

// POST /api/sessions/copilot — start a Copilot CLI session (convenience endpoint)
router.post('/copilot', (req, res) => {
  const { projectId, projectPath } = req.body;
  if (!projectId || !projectPath) {
    res.status(400).json({ error: 'projectId and projectPath are required' });
    return;
  }
  try {
    const session = startCopilotSession(projectId, projectPath);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Failed to start copilot session:', err);
    res.status(500).json({ error: err.message || 'Failed to start copilot session' });
  }
});

// DELETE /api/sessions/:id — stop a session
router.delete('/:id', (req, res) => {
  const session = stopSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

// POST /api/sessions/:id/input — send input to session stdin
router.post('/:id/input', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const ok = sendInput(req.params.id, text);
  if (!ok) {
    res.status(400).json({ error: 'Session not active or not found' });
    return;
  }
  res.json({ sent: true });
});

// GET /api/sessions/:id/output — get buffered output lines
router.get('/:id/output', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const output = getSessionOutput(req.params.id);
  res.json({ sessionId: req.params.id, output });
});

export default router;
