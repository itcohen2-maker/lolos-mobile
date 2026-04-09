// ============================================================
// server/src/socketHandlers.ts — Socket.io event handlers
// Connects Room Manager + Game Engine
// ============================================================

import type { Server, Socket } from 'socket.io';
import type { AppLocale, ClientToServerEvents, ServerToClientEvents, ServerGameState, Operation } from '../../shared/types';
import type { LocalizedMessage } from '../../shared/i18n';
import { t, lastMoveSignature, formatLastMove } from '../../shared/i18n';
import {
  createRoom, joinRoom, leaveRoom, reconnectPlayer,
  getRoomBySocket, isHost,
} from './roomManager';
import {
  startGame, beginTurn, doRollDice, confirmEquation,
  stageCard, unstageCard, confirmStaged,
  playIdentical, playFraction, defendFractionSolve, defendFractionPenalty,
  playOperation, playJoker, drawCard, doEndTurn,
  getPlayerView,
  forceTurnTimeout,
  withOnlineTurnDeadline,
} from './gameEngine';
import type { Room } from './roomManager';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function playerLocale(room: Room, playerId: string): AppLocale {
  return room.players.find((p) => p.id === playerId)?.locale ?? 'he';
}

/** Per-player toast text (mixed locales in one room). */
function emitRoomToasts(io: IOServer, room: Room): void {
  if (!room.state?.lastMoveMessage) return;
  for (const player of room.players) {
    if (!player.isConnected) continue;
    const text = formatLastMove(player.locale, room.state.lastMoveMessage);
    if (!text) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (sock.rooms.has(room.code)) {
        const info = getRoomBySocket(sock.id);
        if (info && info.playerId === player.id) {
          sock.emit('toast', { message: text });
          break;
        }
      }
    }
  }
}

// ── Helper: broadcast updated state to all players in room ──

function clearRoomTurnTimer(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = undefined;
  }
}

function scheduleRoomTurnTimer(io: IOServer, room: Room): void {
  clearRoomTurnTimer(room);
  if (!room.state?.turnDeadlineAt) return;
  const ms = Math.max(0, room.state.turnDeadlineAt - Date.now());
  room.turnTimer = setTimeout(() => {
    room.turnTimer = undefined;
    if (!room.state?.turnDeadlineAt) return;
    if (Date.now() < room.state.turnDeadlineAt - 150) {
      scheduleRoomTurnTimer(io, room);
      return;
    }
    const res = forceTurnTimeout(room.state);
    if ('error' in res) return;
    const prevSig = lastMoveSignature(room.state.lastMoveMessage);
    room.state = withOnlineTurnDeadline(res);
    room.lastActivity = Date.now();
    if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
      emitRoomToasts(io, room);
    }
    broadcastState(io, room);
    scheduleRoomTurnTimer(io, room);
  }, ms);
}

function broadcastState(io: IOServer, room: Room): void {
  if (!room.state) return;
  // Send personalized view to each connected player
  for (const player of room.players) {
    if (!player.isConnected) continue;
    // Find the socket for this player
    const sockets = io.sockets.sockets;
    for (const [, sock] of sockets) {
      if (sock.rooms.has(room.code)) {
        const info = getRoomBySocket(sock.id);
        if (info && info.playerId === player.id) {
          sock.emit('state_update', getPlayerView(room.state, player.id, player.locale));
          break;
        }
      }
    }
  }
}

// ── Helper: apply a game action that may return error ──

function applyAction(
  io: IOServer, socket: IOSocket, room: Room, actorPlayerId: string,
  actionFn: (st: ServerGameState) => ServerGameState | { error: LocalizedMessage }
): void {
  if (!room.state) {
    socket.emit('error', { message: t(playerLocale(room, actorPlayerId), 'game.notStarted') });
    return;
  }

  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
  }

  const result = actionFn(room.state);

  if ('error' in result) {
    socket.emit('error', {
      message: t(playerLocale(room, actorPlayerId), result.error.key, result.error.params),
    });
    return;
  }

  const prevSig = lastMoveSignature(room.state.lastMoveMessage);
  room.state = withOnlineTurnDeadline(result);
  room.lastActivity = Date.now();

  if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
    emitRoomToasts(io, room);
  }

  broadcastState(io, room);
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
    broadcastState(io, room);
  }
  scheduleRoomTurnTimer(io, room);
}

// ── Helper: verify it's this player's turn ──

function isMyTurn(room: Room, playerId: string): boolean {
  if (!room.state) return false;
  const current = room.state.players[room.state.currentPlayerIndex];
  if (!current) return false;
  if (current.isEliminated || current.isSpectator) return false;
  return current.id === playerId;
}

function canPlayerAct(room: Room, playerId: string): { ok: true } | { ok: false; reason: LocalizedMessage } {
  if (!room.state) return { ok: false, reason: { key: 'game.notStarted' } };
  const player = room.state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: { key: 'game.playerNotFound' } };
  if (player.isEliminated || player.isSpectator) {
    return { ok: false, reason: { key: 'game.eliminatedSpectator' } };
  }
  if (!isMyTurn(room, playerId)) return { ok: false, reason: { key: 'game.notYourTurn' } };
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════
//  REGISTER ALL SOCKET HANDLERS
// ══════════════════════════════════════════════════════════════

export function registerSocketHandlers(io: IOServer, socket: IOSocket): void {

  // ── Room Management ──

  socket.on('create_room', ({ playerName, locale }) => {
    const loc = locale ?? 'he';
    const { room, playerId } = createRoom(playerName, socket.id, loc);
    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId });
    io.to(room.code).emit('player_joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
    });
  });

  socket.on('join_room', ({ roomCode, playerName, locale }) => {
    const loc = locale ?? 'he';
    const result = joinRoom(roomCode, playerName, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId });
    io.to(room.code).emit('player_joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
    });
  });

  socket.on('leave_room', () => {
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    socket.leave(room.code);
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.players.length > 0) {
      io.to(room.code).emit('player_joined', {
        players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
      });
    }
  });

  socket.on('reconnect', ({ roomCode, playerId, locale }) => {
    const result = reconnectPlayer(roomCode, playerId, socket.id, locale);
    if ('error' in result) {
      socket.emit('error', { message: t(locale ?? 'he', result.error.key, result.error.params) });
      return;
    }
    const { room, player } = result;
    socket.join(room.code);
    if (room.state) {
      socket.emit('state_update', getPlayerView(room.state, playerId, player.locale));
    }
    io.to(room.code).emit('player_joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
    });
  });

  // ── Game Start ──

  socket.on('start_game', ({ difficulty, gameSettings }) => {
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) { socket.emit('error', { message: t(loc, 'game.noRoom') }); return; }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) { socket.emit('error', { message: t(loc, 'game.hostOnlyStart') }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: t(loc, 'game.minTwoPlayers') }); return; }
    if (room.state) { socket.emit('error', { message: t(loc, 'room.gameAlreadyStarted') }); return; }

    room.state = startGame(room, difficulty, gameSettings);
    room.lastActivity = Date.now();

    // Send personalized game_started to each player
    for (const player of room.players) {
      const sockets = io.sockets.sockets;
      for (const [, sock] of sockets) {
        if (sock.rooms.has(room.code)) {
          const si = getRoomBySocket(sock.id);
          if (si && si.playerId === player.id) {
            sock.emit('game_started', getPlayerView(room.state!, player.id, player.locale));
            break;
          }
        }
      }
    }
    scheduleRoomTurnTimer(io, room);
  });

  // ── Game Actions (require current turn) ──

  socket.on('begin_turn', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => beginTurn(st));
  });

  socket.on('roll_dice', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => doRollDice(st));
  });

  socket.on('confirm_equation', ({ result, equationDisplay, equationCommit }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => confirmEquation(st, result, equationDisplay, equationCommit));
  });

  socket.on('stage_card', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => stageCard(st, cardId));
  });

  socket.on('unstage_card', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => unstageCard(st, cardId));
  });

  socket.on('confirm_staged', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => confirmStaged(st));
  });

  socket.on('place_identical', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => playIdentical(st, cardId));
  });

  socket.on('play_fraction', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => playFraction(st, cardId));
  });

  socket.on('defend_fraction_solve', ({ cardId, wildResolve }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => defendFractionSolve(st, cardId, wildResolve));
  });

  socket.on('defend_fraction_penalty', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => defendFractionPenalty(st));
  });

  socket.on('play_operation', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => playOperation(st, cardId));
  });

  socket.on('play_joker', ({ cardId, chosenOperation }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => playJoker(st, cardId, chosenOperation));
  });

  socket.on('draw_card', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => drawCard(st));
  });

  socket.on('end_turn', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (st) => doEndTurn(st));
  });

  // ── Disconnect ──

  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    const result = leaveRoom(socket.id);
    if (result) {
      const { room, playerId, playerName } = result;
      io.to(room.code).emit('player_left', { playerId, playerName });
      if (room.state) {
        broadcastState(io, room);
      } else if (room.players.length > 0) {
        io.to(room.code).emit('player_joined', {
          players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
        });
      }
    }
  });
}
