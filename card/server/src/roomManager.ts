// ============================================================
// server/src/roomManager.ts - Room create/join/leave/reconnect
// ============================================================

import { randomInt } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppLocale,
  HostGameSettings,
  LobbyStatus,
  LobbyTableStatus,
  LobbyTableSummary,
  LobbyTableTheme,
  LobbyTableVisibility,
  Player,
  ServerGameState,
} from '../../shared/types';
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
  countdownTimer?: ReturnType<typeof setTimeout> | null;
  /** Epoch ms when startGame was called — used as startedAt for match recording */
  gameStartedAt?: number;
  /** Guard: true once recordMatch has been called for this game session */
  matchRecorded?: boolean;
  tableVisibility: LobbyTableVisibility;
  tableStatus: LobbyTableStatus;
  inviteCode: string | null;
  maxParticipants: number;
  countdownEndsAt: number | null;
  hasRandomJoiner: boolean;
  tableTheme: LobbyTableTheme;
  configuredDifficulty: 'easy' | 'full' | null;
  configuredGameSettings: Partial<HostGameSettings> | null;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, { roomCode: string; playerId: string }>();

const CODE_CHARS = '0123456789';
const CODE_LENGTH = 4;
const INVITE_CODE_LENGTH = 6;
const TABLE_MIN_PARTICIPANTS = 2;
const TABLE_MAX_PARTICIPANTS = 6;

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

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(0, CODE_CHARS.length)];
  }
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
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = undefined;
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
    tableVisibility: 'public',
    tableStatus: 'configuring',
    inviteCode: null,
    maxParticipants: TABLE_MAX_PARTICIPANTS,
    countdownEndsAt: null,
    hasRandomJoiner: false,
    tableTheme: 'classic',
    configuredDifficulty: null,
    configuredGameSettings: null,
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
  if (room.tableStatus === 'configuring') return { error: { key: 'room.notConfigured' } };
  if (room.tableStatus === 'countdown') return { error: { key: 'room.notJoinable' } };
  if (room.players.length >= room.maxParticipants) return { error: { key: 'room.full', params: { count: room.maxParticipants } } };
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

export function joinPrivateRoom(
  roomCode: string,
  inviteCode: string,
  playerName: string,
  socketId: string,
  locale: AppLocale = 'he',
): { room: Room; playerId: string } | { error: LocalizedMessage } {
  const room = rooms.get(roomCode);
  if (!room) return { error: { key: 'room.notFound' } };
  if (room.tableVisibility !== 'private_locked') return { error: { key: 'room.notJoinable' } };
  if ((room.inviteCode ?? '') !== inviteCode.trim()) return { error: { key: 'room.invalidInviteCode' } };
  return joinRoom(roomCode, playerName, socketId, locale);
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
      if (room.countdownEndsAt != null && room.players.filter((candidate) => !candidate.isBot).length < 2) {
        room.countdownEndsAt = null;
        room.tableStatus = 'waiting';
        if (room.countdownTimer) {
          clearTimeout(room.countdownTimer);
          room.countdownTimer = undefined;
        }
      }
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
  room.tableStatus = 'in_game';
  room.countdownEndsAt = null;
  if (room.botOfferTimer) {
    clearTimeout(room.botOfferTimer);
    room.botOfferTimer = undefined;
  }
  return bot;
}

export function configureRoomTable(
  room: Room,
  config: {
    visibility: LobbyTableVisibility;
    maxParticipants: number;
    difficulty: 'easy' | 'full';
    gameSettings?: Partial<HostGameSettings>;
  },
): void {
  const maxParticipants = Math.max(TABLE_MIN_PARTICIPANTS, Math.min(TABLE_MAX_PARTICIPANTS, Math.floor(config.maxParticipants)));
  room.tableVisibility = config.visibility;
  room.maxParticipants = maxParticipants;
  room.inviteCode = config.visibility === 'private_locked' ? generateInviteCode() : null;
  room.configuredDifficulty = config.difficulty;
  room.configuredGameSettings = config.gameSettings ? { ...config.gameSettings } : {};
  room.tableStatus = room.players.length >= room.maxParticipants ? 'full' : 'waiting';
  room.lastActivity = Date.now();
}

export function markRandomJoiner(room: Room): void {
  room.hasRandomJoiner = true;
  room.lastActivity = Date.now();
}

export function startRoomCountdown(room: Room, ms: number): number {
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  const countdownEndsAt = Date.now() + ms;
  room.countdownEndsAt = countdownEndsAt;
  room.tableStatus = 'countdown';
  room.lastActivity = Date.now();
  return countdownEndsAt;
}

export function clearRoomCountdown(room: Room): void {
  if (room.countdownTimer) {
    clearTimeout(room.countdownTimer);
    room.countdownTimer = undefined;
  }
  room.countdownEndsAt = null;
  if (!room.state) {
    room.tableStatus = room.players.length >= room.maxParticipants ? 'full' : room.configuredDifficulty ? 'waiting' : 'configuring';
  }
}

export function setRoomCountdownTimer(room: Room, timer: ReturnType<typeof setTimeout> | null): void {
  room.countdownTimer = timer;
}

export function syncRoomTableStatus(room: Room): void {
  if (room.state) {
    room.tableStatus = 'in_game';
    room.countdownEndsAt = null;
    return;
  }
  if (room.countdownEndsAt != null) {
    room.tableStatus = 'countdown';
    return;
  }
  if (!room.configuredDifficulty) {
    room.tableStatus = 'configuring';
    return;
  }
  room.tableStatus = room.players.length >= room.maxParticipants ? 'full' : 'waiting';
}

export function getRoomTables(): LobbyTableSummary[] {
  const summaries: LobbyTableSummary[] = [];
  for (const room of rooms.values()) {
    syncRoomTableStatus(room);
    if (room.tableStatus === 'configuring' || room.tableStatus === 'in_game') continue;
    const host = room.players.find((player) => player.isHost && !player.isBot) ?? room.players.find((player) => !player.isBot);
    summaries.push({
      roomCode: room.code,
      hostName: host?.name ?? 'Host',
      visibility: room.tableVisibility,
      status: room.tableStatus,
      currentParticipants: room.players.filter((player) => !player.isBot).length,
      maxParticipants: room.maxParticipants,
      countdownEndsAt: room.countdownEndsAt,
      hasRandomJoiner: room.hasRandomJoiner,
      tableTheme: room.tableTheme,
      configuredDifficulty: room.configuredDifficulty,
      timerSetting: room.configuredGameSettings?.timerSetting ?? null,
      timerCustomSeconds: room.configuredGameSettings?.timerCustomSeconds ?? null,
    });
  }
  return summaries.sort((a, b) => {
    const statusRank = (value: LobbyTableStatus) => {
      if (value === 'waiting') return 0;
      if (value === 'countdown') return 1;
      if (value === 'full') return 2;
      return 3;
    };
    return statusRank(a.status) - statusRank(b.status) || a.roomCode.localeCompare(b.roomCode);
  });
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
