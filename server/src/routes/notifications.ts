import { Router } from 'express';
import { loadNotifications, saveNotifications } from '../services/storage.js';

const router = Router();

// GET /api/notifications — Get all notifications
router.get('/', async (_req, res) => {
  try {
    const notifications = await loadNotifications();
    res.json(notifications);
  } catch (err) {
    console.error('Failed to load notifications:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// PUT /api/notifications/:id/read — Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notifications = await loadNotifications();
    const index = notifications.findIndex(n => n.id === req.params.id);

    if (index === -1) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    notifications[index].read = true;
    await saveNotifications(notifications);

    res.json(notifications[index]);
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// DELETE /api/notifications — Clear all notifications
router.delete('/', async (_req, res) => {
  try {
    await saveNotifications([]);
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    console.error('Failed to clear notifications:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export default router;
