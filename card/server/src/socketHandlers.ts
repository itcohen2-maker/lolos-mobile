// ============================================================
// server/src/socketHandlers.ts - Socket.io event handlers
// Connects Room Manager + Game Engine + bot fallback
// ============================================================

import type { Server, Socket } from 'socket.io';
import type {
  AppLocale,
  Card,
  ClientToServerEvents,
  EquationCommitPayload,
  HostGameSettings,
  Player,
  ServerGameState,
  ServerToClientEvents,
  StartBotGameAck,
} from '../../shared/types';
import type { LocalizedMessage } from '../../shared/i18n';
import { t, lastMoveSignature, formatLastMove } from '../../shared/i18n';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  reconnectPlayer,
  getRoomBySocket,
  isHost,
  addBotPlayer,
  hasBot,
} from './roomManager';
import {
  startGame,
  beginTurn,
  doRollDice,
  confirmEquation,
  stageCard,
  unstageCard,
  confirmStaged,
  playIdentical,
  playFraction,
  defendFractionSolve,
  defendFractionPenalty,
  playOperation,
  playJoker,
  drawCard,
  doEndTurn,
  getPlayerView,
  forceTurnTimeout,
  withOnlineTurnDeadline,
} from './gameEngine';
import { validateFractionPlay, validateIdenticalPlay, validateStagedCards } from './equations';
import type { Room } from './roomManager';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const BOT_OFFER_DELAY_MS = 15_000;

function playerLocale(room: Room, playerId: string): AppLocale {
  return room.players.find((player) => player.id === playerId)?.locale ?? 'he';
}

function getHumanPlayers(room: Room): Player[] {
  return room.players.filter((player) => !player.isBot);
}

function currentPlayer(room: Room): Player | undefined {
  if (!room.state) return undefined;
  return room.state.players[room.state.currentPlayerIndex];
}

function emitRoomPlayers(io: IOServer, room: Room): void {
  io.to(room.code).emit('player_joined', {
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      isConnected: player.isConnected,
      isBot: player.isBot,
    })),
  });
}

function emitLobbyStatus(io: IOServer, room: Room): void {
  io.to(room.code).emit('lobby_status', {
    status: room.lobbyStatus,
    botOfferAt: room.botOfferAt,
  });
}

function clearBotOfferTimer(room: Room): void {
  if (room.botOfferTimer) {
    clearTimeout(room.botOfferTimer);
    room.botOfferTimer = undefined;
  }
}

function clearBotActionTimer(room: Room): void {
  if (room.botActionTimer) {
    clearTimeout(room.botActionTimer);
    room.botActionTimer = undefined;
  }
}

function emitRoomToasts(io: IOServer, room: Room): void {
  if (!room.state?.lastMoveMessage) return;
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    const text = formatLastMove(player.locale, room.state.lastMoveMessage);
    if (!text) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(room.code)) continue;
      const info = getRoomBySocket(sock.id);
      if (info && info.playerId === player.id) {
        sock.emit('toast', { message: text });
        break;
      }
    }
  }
}

function clearRoomTurnTimer(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = undefined;
  }
}

function sendGameStarted(io: IOServer, room: Room): void {
  if (!room.state) return;
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(room.code)) continue;
      const info = getRoomBySocket(sock.id);
      if (info && info.playerId === player.id) {
        sock.emit('game_started', getPlayerView(room.state, player.id, player.locale));
        break;
      }
    }
  }
}

function broadcastState(io: IOServer, room: Room): void {
  if (!room.state) return;
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    for (const [, sock] of io.sockets.sockets) {
      if (!sock.rooms.has(room.code)) continue;
      const info = getRoomBySocket(sock.id);
      if (info && info.playerId === player.id) {
        sock.emit('state_update', getPlayerView(room.state, player.id, player.locale));
        break;
      }
    }
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
    const result = forceTurnTimeout(room.state);
    if ('error' in result) return;
    const prevSig = lastMoveSignature(room.state.lastMoveMessage);
    room.state = withOnlineTurnDeadline(result);
    room.lastActivity = Date.now();
    if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
      emitRoomToasts(io, room);
    }
    broadcastState(io, room);
    scheduleRoomTurnTimer(io, room);
    scheduleBotAction(io, room);
  }, ms);
}

function scheduleBotOffer(io: IOServer, room: Room): void {
  clearBotOfferTimer(room);
  if (room.state || hasBot(room) || getHumanPlayers(room).length !== 1) return;
  room.lobbyStatus = 'waiting_for_player';
  room.botOfferAt = Date.now() + BOT_OFFER_DELAY_MS;
  emitLobbyStatus(io, room);
  room.botOfferTimer = setTimeout(() => {
    room.botOfferTimer = undefined;
    if (room.state || hasBot(room) || getHumanPlayers(room).length !== 1) return;
    room.lobbyStatus = 'bot_offer';
    room.botOfferAt = null;
    emitLobbyStatus(io, room);
  }, BOT_OFFER_DELAY_MS);
}

function refreshLobbyStatus(io: IOServer, room: Room): void {
  if (room.state) {
    room.lobbyStatus = hasBot(room) ? 'bot_game_started' : 'waiting_for_player';
    room.botOfferAt = null;
    clearBotOfferTimer(room);
    emitLobbyStatus(io, room);
    return;
  }

  const humanCount = getHumanPlayers(room).length;
  if (hasBot(room)) {
    room.lobbyStatus = 'bot_game_started';
    room.botOfferAt = null;
    clearBotOfferTimer(room);
    emitLobbyStatus(io, room);
    return;
  }

  if (humanCount === 1) {
    scheduleBotOffer(io, room);
    return;
  }

  room.lobbyStatus = 'waiting_for_player';
  room.botOfferAt = null;
  clearBotOfferTimer(room);
  emitLobbyStatus(io, room);
}

function applyAction(
  io: IOServer,
  socket: IOSocket,
  room: Room,
  actorPlayerId: string,
  actionFn: (state: ServerGameState) => ServerGameState | { error: LocalizedMessage },
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
  scheduleBotAction(io, room);
}

function applyBotState(
  io: IOServer,
  room: Room,
  actionFn: (state: ServerGameState) => ServerGameState | { error: LocalizedMessage },
): boolean {
  if (!room.state) return false;
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
  }

  const result = actionFn(room.state);
  if ('error' in result) return false;

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
  return true;
}

function isMyTurn(room: Room, playerId: string): boolean {
  if (!room.state) return false;
  const player = currentPlayer(room);
  if (!player || player.isEliminated || player.isSpectator) return false;
  return player.id === playerId;
}

function canPlayerAct(room: Room, playerId: string): { ok: true } | { ok: false; reason: LocalizedMessage } {
  if (!room.state) return { ok: false, reason: { key: 'game.notStarted' } };
  const player = room.state.players.find((candidate) => candidate.id === playerId);
  if (!player) return { ok: false, reason: { key: 'game.playerNotFound' } };
  if (player.isEliminated || player.isSpectator) {
    return { ok: false, reason: { key: 'game.eliminatedSpectator' } };
  }
  if (!isMyTurn(room, playerId)) return { ok: false, reason: { key: 'game.notYourTurn' } };
  return { ok: true };
}

/** בוט משתמש לכל היותר בקלף פעולה/ג'וקר אחד במשבצת 0 */
function buildBotCommits(state: ServerGameState): EquationCommitPayload[] {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const operationCard = hand.find((card) => card.type === 'operation');
  if (operationCard) {
    return [{ cardId: operationCard.id, position: 0, jokerAs: null }];
  }
  const jokerCard = hand.find((card) => card.type === 'joker');
  if (jokerCard) {
    return [
      {
        cardId: jokerCard.id,
        position: 0,
        jokerAs: state.hostGameSettings.enabledOperators?.[0] ?? '+',
      },
    ];
  }
  return [];
}

function buildBotStagedPlan(state: ServerGameState): {
  target: number;
  equationDisplay: string;
  stagedCards: Card[];
  equationCommits: EquationCommitPayload[];
} | null {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const candidates = hand.filter((card) => card.type === 'number' || card.type === 'wild');
  const equationCommits = buildBotCommits(state);

  let bestPlan: {
    target: number;
    equationDisplay: string;
    stagedCards: Card[];
    equationCommits: EquationCommitPayload[];
    score: number;
  } | null = null;

  const totalMasks = 1 << candidates.length;
  for (const option of state.validTargets) {
    for (let mask = 1; mask < totalMasks; mask++) {
      const stagedCards: Card[] = [];
      let wildCount = 0;
      for (let index = 0; index < candidates.length; index++) {
        if ((mask & (1 << index)) === 0) continue;
        const card = candidates[index];
        if (card.type === 'wild') wildCount++;
        stagedCards.push(card);
      }
      if (wildCount > 1) continue;
      if (!validateStagedCards(stagedCards, null, option.result, state.hostGameSettings?.mathRangeMax ?? 25)) continue;
      const score = stagedCards.length + equationCommits.length;
      if (!bestPlan || score > bestPlan.score) {
        bestPlan = {
          target: option.result,
          equationDisplay: option.equation,
          stagedCards,
          equationCommits,
          score,
        };
      }
    }
  }

  if (!bestPlan) return null;
  return {
    target: bestPlan.target,
    equationDisplay: bestPlan.equationDisplay,
    stagedCards: bestPlan.stagedCards,
    equationCommits: bestPlan.equationCommits,
  };
}

function handleBotDefense(io: IOServer, room: Room, state: ServerGameState): void {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const divisibleCard = hand.find((card) => card.type === 'number' && (card.value ?? 0) > 0 && (card.value ?? 0) % state.fractionPenalty === 0);
  if (divisibleCard) {
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, divisibleCard.id));
    return;
  }

  const wildCard = hand.find((card) => card.type === 'wild');
  if (wildCard) {
    const wildResolve = Math.max(state.fractionPenalty, 1);
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, wildCard.id, wildResolve));
    return;
  }

  const counterFraction = hand.find((card) => card.type === 'fraction');
  if (counterFraction) {
    applyBotState(io, room, (currentState) => playFraction(currentState, counterFraction.id));
    return;
  }

  applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
}

function handleBotPreRoll(io: IOServer, room: Room, state: ServerGameState): void {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const identicalCard = hand.find((card) => validateIdenticalPlay(card, topDiscard));
  if (identicalCard) {
    applyBotState(io, room, (currentState) => playIdentical(currentState, identicalCard.id));
    return;
  }

  const attackFraction = hand.find((card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard));
  if (attackFraction) {
    applyBotState(io, room, (currentState) => playFraction(currentState, attackFraction.id));
    return;
  }

  applyBotState(io, room, (currentState) => doRollDice(currentState));
}

function handleBotBuilding(io: IOServer, room: Room, state: ServerGameState): void {
  const plan = buildBotStagedPlan(state);
  if (!plan) {
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  const equationOk = applyBotState(io, room, (currentState) =>
    confirmEquation(currentState, plan.target, plan.equationDisplay, plan.equationCommits),
  );
  if (!equationOk || !room.state) {
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  for (const stagedCard of plan.stagedCards) {
    const stagedOk = applyBotState(io, room, (currentState) => stageCard(currentState, stagedCard.id));
    if (!stagedOk) {
      applyBotState(io, room, (currentState) => drawCard(currentState));
      return;
    }
  }

  const confirmed = applyBotState(io, room, (currentState) => confirmStaged(currentState));
  if (!confirmed) {
    for (const stagedCard of plan.stagedCards) {
      applyBotState(io, room, (currentState) => unstageCard(currentState, stagedCard.id));
    }
    applyBotState(io, room, (currentState) => drawCard(currentState));
  }
}

function runBotStep(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  switch (room.state.phase) {
    case 'turn-transition':
      applyBotState(io, room, (state) => beginTurn(state));
      break;
    case 'pre-roll':
      if (room.state.pendingFractionTarget !== null) handleBotDefense(io, room, room.state);
      else handleBotPreRoll(io, room, room.state);
      break;
    case 'building':
      handleBotBuilding(io, room, room.state);
      break;
    case 'solved':
      applyBotState(io, room, (state) => doEndTurn(state));
      break;
    default:
      break;
  }

  scheduleBotAction(io, room);
}

function scheduleBotAction(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  const delay = 900 + Math.floor(Math.random() * 700);
  room.botActionTimer = setTimeout(() => runBotStep(io, room), delay);
}

function startRoomGame(
  io: IOServer,
  room: Room,
  difficulty: 'easy' | 'full',
  gameSettings?: Partial<HostGameSettings>,
): void {
  room.state = startGame(room, difficulty, gameSettings);
  room.lastActivity = Date.now();
  room.lobbyStatus = hasBot(room) ? 'bot_game_started' : 'waiting_for_player';
  room.botOfferAt = null;
  emitLobbyStatus(io, room);
  sendGameStarted(io, room);
  scheduleRoomTurnTimer(io, room);
  scheduleBotAction(io, room);
}

export function registerSocketHandlers(io: IOServer, socket: IOSocket): void {
  socket.on('create_room', ({ playerName, locale }) => {
    const loc = locale ?? 'he';
    const { room, playerId } = createRoom(playerName, socket.id, loc);
    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId });
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
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
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
  });

  socket.on('leave_room', () => {
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    socket.leave(room.code);
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.players.length > 0) {
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
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
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    scheduleBotAction(io, room);
  });

  socket.on('start_game', ({ difficulty, gameSettings }) => {
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyStart') });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: t(loc, 'game.minTwoPlayers') });
      return;
    }
    if (room.state) {
      socket.emit('error', { message: t(loc, 'room.gameAlreadyStarted') });
      return;
    }

    startRoomGame(io, room, difficulty, gameSettings);
  });

  socket.on('start_bot_game', ({ difficulty, gameSettings }, ack) => {
    const reply = (result: StartBotGameAck) => {
      if (typeof ack === 'function') ack(result);
    };
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      const message = t(loc, 'game.noRoom');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      const message = t(loc, 'game.hostOnlyStart');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    if (room.state) {
      const message = t(loc, 'room.gameAlreadyStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    if (getHumanPlayers(room).length > 1) {
      const message = t(loc, 'game.botAlreadyHasOpponent');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    addBotPlayer(room, loc);
    emitRoomPlayers(io, room);
    startRoomGame(io, room, difficulty, gameSettings);
    if (!room.state) {
      const message = t(loc, 'game.notStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    const playerView = getPlayerView(room.state, playerId, playerLocale(room, playerId));
    reply({ ok: true, playerView });
  });

  socket.on('begin_turn', () => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => beginTurn(state));
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
    applyAction(io, socket, room, playerId, (state) => doRollDice(state));
  });

  socket.on('confirm_equation', ({ result, equationDisplay, equationCommits, equationCommit }) => {
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) =>
      confirmEquation(state, result, equationDisplay, equationCommits, equationCommit),
    );
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
    applyAction(io, socket, room, playerId, (state) => stageCard(state, cardId));
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
    applyAction(io, socket, room, playerId, (state) => unstageCard(state, cardId));
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
    applyAction(io, socket, room, playerId, (state) => confirmStaged(state));
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
    applyAction(io, socket, room, playerId, (state) => playIdentical(state, cardId));
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
    applyAction(io, socket, room, playerId, (state) => playFraction(state, cardId));
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
    applyAction(io, socket, room, playerId, (state) => defendFractionSolve(state, cardId, wildResolve));
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
    applyAction(io, socket, room, playerId, (state) => defendFractionPenalty(state));
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
    applyAction(io, socket, room, playerId, (state) => playOperation(state, cardId));
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
    applyAction(io, socket, room, playerId, (state) => playJoker(state, cardId, chosenOperation));
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
    applyAction(io, socket, room, playerId, (state) => drawCard(state));
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
    applyAction(io, socket, room, playerId, (state) => doEndTurn(state));
  });

  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.state) {
      broadcastState(io, room);
      scheduleBotAction(io, room);
    } else if (room.players.length > 0) {
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
    }
  });
}
