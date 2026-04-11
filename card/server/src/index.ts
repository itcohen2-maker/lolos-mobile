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

// 0.0.0.0 — טלפון/אמולטור ברשת המקומית מתחברים ל־http://<IP-המחשב>:PORT
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎴 Lolos server listening on 0.0.0.0:${PORT} (LAN: use this PC's IP)`);
});
