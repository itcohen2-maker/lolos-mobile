// ============================================================
// server/src/index.ts — Lolos Game Server Entry Point
// Express + Socket.io
// ============================================================

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types';
import { registerSocketHandlers } from './socketHandlers';
import { cleanupStaleRooms } from './roomManager';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', game: 'lolos', timestamp: Date.now() });
});

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  registerSocketHandlers(io, socket);
});

// Cleanup stale rooms every 5 minutes
setInterval(() => {
  cleanupStaleRooms();
}, 5 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`🎴 Lolos server running on port ${PORT}`);
});
