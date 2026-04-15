// ============================================================
// server/src/roomManager.ts - Room create/join/leave/reconnect
// ============================================================

import { randomInt } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type { AppLocale, LobbyStatus, Player, ServerGameState } from '../../shared/types';
import type { LocalizedMessage } from '../../shared/i18n';
import { sanitizePlayerName } from '../../shared/validation';

export interface Room {
  code: string;
  players: Player[];
  state: ServerGameState | null;
  createdAt: number;
  lastActivity: number;
  lobbyStatus: LobbyStatus;
  botOfferAt: number | null;
  botOfferTimer?: ReturnType<typeof setTimeout> | null;
  botActionTimer?: ReturnType<typeof setTimeout> | null;
  turnTimer?: ReturnType<typeof setTimeout> | null;
  disconnectDeadlineAt: number | null;
  disconnectedPlayerId: string | null;
  disconnectTimer?: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, { roomCode: string; playerId: string }>();

const CODE_CHARS = '0123456789';
const CODE_LENGTH = 4;

function generateRoomCode(): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomInt(0, CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function localizedBotName(locale: AppLocale): string {
  return locale === 'he' ? 'בוט' : 'Bot';
}

function sanitizeBotDisplayName(raw: unknown): string | undefined {
  return sanitizePlayerName(raw) ?? undefined;
}

function clearRoomTimers(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = undefined;
  }
  if (room.botOfferTimer) {
    clearTimeout(room.botOfferTimer);
    room.botOfferTimer = undefined;
  }
  if (room.botActionTimer) {
    clearTimeout(room.botActionTimer);
    room.botActionTimer = undefined;
  }
  if (room.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
    room.disconnectTimer = undefined;
  }
}

export const DISCONNECT_GRACE_MS = 2 * 60 * 1000;

export function createRoom(
  playerName: string,
  socketId: string,
  locale: AppLocale = 'he',
): { room: Room; playerId: string } {
  const code = generateRoomCode();
  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: playerName,
    hand: [],
    calledLolos: false,
    isConnected: true,
    isHost: true,
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale,
  };
  const room: Room = {
    code,
    players: [player],
    state: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    lobbyStatus: 'waiting_for_player',
    botOfferAt: null,
    disconnectDeadlineAt: null,
    disconnectedPlayerId: null,
  };
  rooms.set(code, room);
  socketToRoom.set(socketId, { roomCode: code, playerId });
  console.log(`[ROOM] Created ${code} by "${playerName}" (${playerId})`);
  return { room, playerId };
}

export function joinRoom(
  roomCode: string,
  playerName: string,
  socketId: string,
  locale: AppLocale = 'he',
): { room: Room; playerId: string } | { error: LocalizedMessage } {
  const room = rooms.get(roomCode);
  if (!room) return { error: { key: 'room.notFound' } };
  if (room.state) return { error: { key: 'room.gameAlreadyStarted' } };
  if (room.players.length >= 6) return { error: { key: 'room.full' } };
  if (room.players.some((player) => player.name === playerName)) return { error: { key: 'room.nameTaken' } };

  const playerId = uuidv4();
  const player: Player = {
    id: playerId,
    name: playerName,
    hand: [],
    calledLolos: false,
    isConnected: true,
    isHost: false,
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale,
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
  if (!room) {
    socketToRoom.delete(socketId);
    return null;
  }

  clearRoomTimers(room);

  const player = room.players.find((candidate) => candidate.id === info.playerId);
  if (!player) {
    socketToRoom.delete(socketId);
    return null;
  }

  const playerName = player.name;

  if (room.state) {
    player.isConnected = false;
    room.lastActivity = Date.now();
    if (!player.isBot) {
      room.disconnectedPlayerId = player.id;
    }
  } else {
    room.players = room.players.filter((candidate) => candidate.id !== info.playerId);
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
    }
    if (room.players.length === 0) {
      rooms.delete(info.roomCode);
      console.log(`[ROOM] Deleted empty room ${info.roomCode}`);
    } else {
      room.lobbyStatus = 'waiting_for_player';
      room.botOfferAt = null;
      room.disconnectDeadlineAt = null;
      room.disconnectedPlayerId = null;
    }
  }

  socketToRoom.delete(socketId);
  console.log(`[ROOM] ${playerName} left ${info.roomCode}`);
  return { room, playerId: info.playerId, playerName };
}

export function reconnectPlayer(
  roomCode: string,
  playerId: string,
  socketId: string,
  locale?: AppLocale,
): { room: Room; player: Player } | { error: LocalizedMessage } {
  const room = rooms.get(roomCode);
  if (!room) return { error: { key: 'room.notFound' } };
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: { key: 'room.playerNotInRoom' } };

  player.isConnected = true;
  if (locale) player.locale = locale;
  room.lastActivity = Date.now();
  socketToRoom.set(socketId, { roomCode, playerId });
  console.log(`[ROOM] ${player.name} reconnected to ${roomCode}`);
  return { room, player };
}

export function setDisconnectGraceTimer(
  room: Room,
  disconnectedPlayerId: string,
  onExpire: (room: Room, disconnectedPlayerId: string) => void,
): number {
  clearDisconnectGraceTimer(room);
  const deadlineAt = Date.now() + DISCONNECT_GRACE_MS;
  room.disconnectedPlayerId = disconnectedPlayerId;
  room.disconnectDeadlineAt = deadlineAt;
  room.disconnectTimer = setTimeout(() => {
    room.disconnectTimer = undefined;
    const targetPlayerId = room.disconnectedPlayerId ?? disconnectedPlayerId;
    room.disconnectDeadlineAt = null;
    onExpire(room, targetPlayerId);
  }, DISCONNECT_GRACE_MS);
  return deadlineAt;
}

export function clearDisconnectGraceTimer(room: Room): void {
  if (room.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
    room.disconnectTimer = undefined;
  }
  room.disconnectDeadlineAt = null;
  room.disconnectedPlayerId = null;
}

export function shouldStartDisconnectGrace(room: Room, disconnectedPlayerId: string): boolean {
  if (!room.state) return false;
  const humans = room.players.filter((player) => !player.isBot);
  const disconnected = humans.find((player) => player.id === disconnectedPlayerId);
  if (!disconnected || disconnected.isConnected) return false;
  return humans.some((player) => player.id !== disconnectedPlayerId && player.isConnected);
}

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
  return room.players.find((player) => player.id === playerId);
}

export function isHost(room: Room, playerId: string): boolean {
  const player = room.players.find((candidate) => candidate.id === playerId);
  return player?.isHost ?? false;
}

export function hasBot(room: Room): boolean {
  return room.players.some((player) => player.isBot);
}

export function addBotPlayer(room: Room, locale: AppLocale = 'he', rawDisplayName?: unknown): Player {
  const existingBot = room.players.find((player) => player.isBot);
  if (existingBot) return existingBot;

  const customName = sanitizeBotDisplayName(rawDisplayName);
  const bot: Player = {
    id: uuidv4(),
    name: customName ?? localizedBotName(locale),
    hand: [],
    calledLolos: false,
    isConnected: true,
    isHost: false,
    isBot: true,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale,
  };
  room.players.push(bot);
  room.lastActivity = Date.now();
  room.lobbyStatus = 'bot_game_started';
  room.botOfferAt = null;
  if (room.botOfferTimer) {
    clearTimeout(room.botOfferTimer);
    room.botOfferTimer = undefined;
  }
  return bot;
}

const ROOM_TIMEOUT_MS = 30 * 60 * 1000;

export function cleanupStaleRooms(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TIMEOUT_MS) {
      clearRoomTimers(room);
      rooms.delete(code);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`[CLEANUP] Removed ${cleaned} stale rooms`);
}
