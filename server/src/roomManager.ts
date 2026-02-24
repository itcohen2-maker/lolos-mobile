// ============================================================
// server/src/roomManager.ts — Room create/join/leave/reconnect
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Player, ServerGameState } from '../../shared/types';

export interface Room {
  code: string;
  players: Player[];
  state: ServerGameState | null;   // null = still in lobby
  createdAt: number;
  lastActivity: number;
}

/** In-memory room store */
const rooms = new Map<string, Room>();

/** Map socket ID → { roomCode, playerId } for quick lookup */
const socketToRoom = new Map<string, { roomCode: string; playerId: string }>();

// ── Room Code Generation ──

function generateRoomCode(): string {
  let code: string;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

// ── Public API ──

export function createRoom(playerName: string, socketId: string): { room: Room; playerId: string } {
  const code = generateRoomCode();
  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: playerName,
    hand: [],
    calledLolos: false,
    isConnected: true,
    isHost: true,
  };
  const room: Room = {
    code,
    players: [player],
    state: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  socketToRoom.set(socketId, { roomCode: code, playerId });
  console.log(`[ROOM] Created ${code} by "${playerName}" (${playerId})`);
  return { room, playerId };
}

export function joinRoom(
  roomCode: string, playerName: string, socketId: string
): { room: Room; playerId: string } | { error: string } {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'חדר לא נמצא' };
  if (room.state) return { error: 'המשחק כבר התחיל' };
  if (room.players.length >= 6) return { error: 'החדר מלא (מקסימום 6 שחקנים)' };
  if (room.players.some(p => p.name === playerName)) return { error: 'השם הזה כבר תפוס' };

  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: playerName,
    hand: [],
    calledLolos: false,
    isConnected: true,
    isHost: false,
  };
  room.players.push(player);
  room.lastActivity = Date.now();
  socketToRoom.set(socketId, { roomCode, playerId });
  console.log(`[ROOM] ${playerName} (${playerId}) joined ${roomCode}`);
  return { room, playerId };
}

export function leaveRoom(socketId: string): { room: Room; playerId: string; playerName: string } | null {
  const info = socketToRoom.get(socketId);
  if (!info) return null;
  const room = rooms.get(info.roomCode);
  if (!room) { socketToRoom.delete(socketId); return null; }

  const player = room.players.find(p => p.id === info.playerId);
  if (!player) { socketToRoom.delete(socketId); return null; }

  const playerName = player.name;

  if (room.state) {
    // Game in progress → mark disconnected, keep slot
    player.isConnected = false;
    room.lastActivity = Date.now();
  } else {
    // In lobby → remove player
    room.players = room.players.filter(p => p.id !== info.playerId);
    // If host left, promote next player or delete room
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
    }
    if (room.players.length === 0) {
      rooms.delete(info.roomCode);
      console.log(`[ROOM] Deleted empty room ${info.roomCode}`);
    }
  }

  socketToRoom.delete(socketId);
  console.log(`[ROOM] ${playerName} left ${info.roomCode}`);
  return { room, playerId: info.playerId, playerName };
}

export function reconnectPlayer(
  roomCode: string, playerId: string, socketId: string
): { room: Room; player: Player } | { error: string } {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'חדר לא נמצא' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'שחקן לא נמצא בחדר' };

  player.isConnected = true;
  room.lastActivity = Date.now();
  socketToRoom.set(socketId, { roomCode, playerId });
  console.log(`[ROOM] ${player.name} reconnected to ${roomCode}`);
  return { room, player };
}

// ── Lookup helpers ──

export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode);
}

export function getRoomBySocket(socketId: string): { room: Room; playerId: string } | null {
  const info = socketToRoom.get(socketId);
  if (!info) return null;
  const room = rooms.get(info.roomCode);
  if (!room) return null;
  return { room, playerId: info.playerId };
}

export function getPlayerInRoom(room: Room, playerId: string): Player | undefined {
  return room.players.find(p => p.id === playerId);
}

export function isHost(room: Room, playerId: string): boolean {
  const player = room.players.find(p => p.id === playerId);
  return player?.isHost ?? false;
}

// ── Cleanup ──

const ROOM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function cleanupStaleRooms(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TIMEOUT_MS) {
      rooms.delete(code);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`[CLEANUP] Removed ${cleaned} stale rooms`);
}
