// ============================================================
// server/src/socketHandlers.ts — Socket.io event handlers
// Connects Room Manager + Game Engine
// ============================================================

import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, ServerGameState, Operation } from '../../shared/types';
import {
  createRoom, joinRoom, leaveRoom, reconnectPlayer,
  getRoomBySocket, isHost, getRoom,
} from './roomManager';
import {
  startGame, beginTurn, doRollDice, confirmEquation,
  stageCard, unstageCard, confirmStaged,
  playIdentical, playFraction, defendFractionSolve, defendFractionPenalty,
  playOperation, playJoker, drawCard, callLulos, doEndTurn,
  getPlayerView,
} from './gameEngine';
import type { Room } from './roomManager';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ── Helper: broadcast updated state to all players in room ──

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
          sock.emit('state_update', getPlayerView(room.state, player.id));
          break;
        }
      }
    }
  }
}

// ── Helper: apply a game action that may return error ──

function applyAction(
  io: IOServer, socket: IOSocket, room: Room,
  actionFn: (st: ServerGameState) => ServerGameState | { error: string }
): void {
  if (!room.state) { socket.emit('error', { message: 'המשחק לא התחיל' }); return; }

  const result = actionFn(room.state);

  if ('error' in result) {
    socket.emit('error', { message: result.error });
    return;
  }

  // Check for toast message
  const prevToast = room.state.lastMoveMessage;
  room.state = result;
  room.lastActivity = Date.now();

  // If there's a new toast message, broadcast it
  if (result.lastMoveMessage && result.lastMoveMessage !== prevToast) {
    io.to(room.code).emit('toast', { message: result.lastMoveMessage });
  }

  broadcastState(io, room);
}

// ── Helper: verify it's this player's turn ──

function isMyTurn(room: Room, playerId: string): boolean {
  if (!room.state) return false;
  return room.state.players[room.state.currentPlayerIndex]?.id === playerId;
}

// ══════════════════════════════════════════════════════════════
//  REGISTER ALL SOCKET HANDLERS
// ══════════════════════════════════════════════════════════════

export function registerSocketHandlers(io: IOServer, socket: IOSocket): void {

  // ── Room Management ──

  socket.on('create_room', ({ playerName }) => {
    const { room, playerId } = createRoom(playerName, socket.id);
    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId });
    io.to(room.code).emit('player_joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
    });
  });

  socket.on('join_room', ({ roomCode, playerName }) => {
    const result = joinRoom(roomCode, playerName, socket.id);
    if ('error' in result) { socket.emit('error', { message: result.error }); return; }
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

  socket.on('reconnect', ({ roomCode, playerId }) => {
    const result = reconnectPlayer(roomCode, playerId, socket.id);
    if ('error' in result) { socket.emit('error', { message: result.error }); return; }
    const { room, player } = result;
    socket.join(room.code);
    if (room.state) {
      socket.emit('state_update', getPlayerView(room.state, playerId));
    }
    io.to(room.code).emit('player_joined', {
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isConnected: p.isConnected })),
    });
  });

  // ── Game Start ──

  socket.on('start_game', ({ difficulty }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) { socket.emit('error', { message: 'לא נמצא חדר' }); return; }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) { socket.emit('error', { message: 'רק המארח יכול להתחיל' }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: 'דרושים לפחות 2 שחקנים' }); return; }
    if (room.state) { socket.emit('error', { message: 'המשחק כבר התחיל' }); return; }

    room.state = startGame(room, difficulty);
    room.lastActivity = Date.now();

    // Send personalized game_started to each player
    for (const player of room.players) {
      const sockets = io.sockets.sockets;
      for (const [, sock] of sockets) {
        if (sock.rooms.has(room.code)) {
          const si = getRoomBySocket(sock.id);
          if (si && si.playerId === player.id) {
            sock.emit('game_started', getPlayerView(room.state, player.id));
            break;
          }
        }
      }
    }
  });

  // ── Game Actions (require current turn) ──

  socket.on('begin_turn', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => beginTurn(st));
  });

  socket.on('roll_dice', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => doRollDice(st));
  });

  socket.on('confirm_equation', ({ result, equationDisplay }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => confirmEquation(st, result, equationDisplay));
  });

  socket.on('stage_card', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => stageCard(st, cardId));
  });

  socket.on('unstage_card', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => unstageCard(st, cardId));
  });

  socket.on('confirm_staged', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => confirmStaged(st));
  });

  socket.on('place_identical', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => playIdentical(st, cardId));
  });

  socket.on('play_fraction', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => playFraction(st, cardId));
  });

  socket.on('defend_fraction_solve', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => defendFractionSolve(st, cardId));
  });

  socket.on('defend_fraction_penalty', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => defendFractionPenalty(st));
  });

  socket.on('play_operation', ({ cardId }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => playOperation(st, cardId));
  });

  socket.on('play_joker', ({ cardId, chosenOperation }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => playJoker(st, cardId, chosenOperation));
  });

  socket.on('draw_card', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => drawCard(st));
  });

  socket.on('end_turn', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state || !isMyTurn(room, playerId)) { socket.emit('error', { message: 'לא התור שלך' }); return; }
    applyAction(io, socket, room, (st) => doEndTurn(st));
  });

  // ── call_lulos — any player can call, not just current ──

  socket.on('call_lulos', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    if (!room.state) { socket.emit('error', { message: 'המשחק לא התחיל' }); return; }
    applyAction(io, socket, room, (st) => callLulos(st, playerId));
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
