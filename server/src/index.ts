import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import projectRoutes from './routes/projects.js';
import squadRoutes from './routes/squad.js';
import notificationRoutes from './routes/notifications.js';
import filesystemRoutes from './routes/filesystem.js';
import { initWebSocket } from './services/websocket.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// API routes
app.use('/api/projects', projectRoutes);
app.use('/api/projects', squadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/filesystem', filesystemRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server and attach WebSocket
const server = createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[squadCenter] Server running at http://localhost:${PORT}`);
  console.log(`[squadCenter] WebSocket available at ws://localhost:${PORT}/ws`);
});
