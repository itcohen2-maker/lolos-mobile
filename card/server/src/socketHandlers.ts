// ============================================================
// server/src/socketHandlers.ts - Socket.io event handlers
// Connects Room Manager + Game Engine + bot fallback
// ============================================================

import type { Server, Socket } from 'socket.io';
import { randomInt } from 'node:crypto';
import type {
  AppLocale,
  BotDifficulty,
  Card,
  ClientToServerEvents,
  ContinueVsBotAck,
  EquationCommitPayload,
  HostGameSettings,
  LobbyTableVisibility,
  Operation,
  Player,
  ServerGameState,
  ServerToClientEvents,
  StartBotGameAck,
} from '../../shared/types';
import { pickBotStagedPlan, botStepDelayRange } from '../../shared/botPlan';
import type { LocalizedMessage } from '../../shared/i18n';
import { t, lastMoveSignature, formatLastMove } from '../../shared/i18n';
import {
  sanitizePlayerName,
  validateRoomCode,
  validateCardId,
  validateLocale,
  validateDifficulty,
  validateOperation,
  sanitizeEquationDisplay,
  validatePlayerId,
} from '../../shared/validation';
import { checkRateLimit, cleanupRateLimit } from './rateLimiter';
import {
  createRoom,
  joinRoom,
  joinPrivateRoom,
  leaveRoom,
  reconnectPlayer,
  getRoomBySocket,
  isHost,
  addBotPlayer,
  clearDisconnectGraceTimer,
  hasBot,
  setDisconnectGraceTimer,
  shouldStartDisconnectGrace,
  configureRoomTable,
  markRandomJoiner,
  startRoomCountdown,
  clearRoomCountdown,
  setRoomCountdownTimer,
  syncRoomTableStatus,
  getRoomTables,
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
  technicalVictory,
} from './gameEngine';
import { validateFractionPlay, validateIdenticalPlay, validateStagedCards } from './equations';
import type { Room } from './roomManager';
import { migrateDifficultyStage } from '../../shared/difficultyStages';
import { normalizeOperationToken } from '../../shared/equationOpCycle';
import { botNarrationToastText, renderBotNarration, type BotNarrationInput } from '../../shared/botNarration';
import { fetchPlayerActiveTableTheme, recordMatch, RATING_WIN, RATING_LOSS, RATING_ABANDON_PENALTY } from './supabaseAdmin';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const BOT_OFFER_DELAY_MS = 0;
const TABLE_START_COUNTDOWN_MS = 30_000;
const BOT_DIFF_LEVELS: BotDifficulty[] = ['easy', 'medium', 'hard'];

/** לקוחות ישנים שעדיין שולחים beginner */
function normalizeBotDifficulty(raw: unknown): BotDifficulty {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  if (raw === 'beginner') return 'easy';
  return 'medium';
}

function normalizeGameSettingsPatch(patch?: Partial<HostGameSettings>): Partial<HostGameSettings> | undefined {
  if (!patch) return undefined;
  const out: Partial<HostGameSettings> = { ...patch };
  if ('botDifficulty' in out && out.botDifficulty != null) {
    out.botDifficulty = normalizeBotDifficulty(out.botDifficulty);
  }
  if (out.difficultyStage != null) {
    out.difficultyStage = migrateDifficultyStage(String(out.difficultyStage));
  }
  if (Array.isArray(out.fractionKinds) && out.fractionKinds.length === 0) {
    delete out.fractionKinds;
  }
  if (Array.isArray(out.enabledOperators)) {
    const normalized = out.enabledOperators
      .map((op) => normalizeOperationToken(op))
      .filter((op): op is Operation => op != null);
    out.enabledOperators = normalized.length > 0 ? [...new Set(normalized)] : undefined;
  }
  return out;
}

function normalizeTableVisibility(raw: unknown): LobbyTableVisibility {
  return raw === 'private_locked' ? 'private_locked' : 'public';
}

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

function emitTablesUpdated(io: IOServer, socket?: IOSocket): void {
  const payload = { tables: getRoomTables() };
  if (socket) {
    socket.emit('tables_updated', payload);
    return;
  }
  io.emit('tables_updated', payload);
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

function cardLabelForLocale(state: ServerGameState, cardId: string, locale: AppLocale): string {
  const card = state.players[state.currentPlayerIndex]?.hand.find((c) => c.id === cardId);
  if (!card) return '—';
  if (card.type === 'number') return String(card.value ?? '?');
  if (card.type === 'fraction') return String(card.fraction ?? '?');
  if (card.type === 'operation') return String(card.operation ?? '?');
  if (card.type === 'wild') return t(locale, 'labels.wild');
  if (card.type === 'joker') return t(locale, 'labels.joker');
  return '—';
}

function cardTypeInCurrentHand(state: ServerGameState, cardId: string): Card['type'] | null {
  return state.players[state.currentPlayerIndex]?.hand.find((c) => c.id === cardId)?.type ?? null;
}

function botNarrationText(locale: AppLocale, input: BotNarrationInput): string {
  const rendered = renderBotNarration((key, params) => t(locale, key, params), input);
  return botNarrationToastText(rendered);
}

function emitBotStepToast(
  io: IOServer,
  room: Room,
  builder: (locale: AppLocale, botName: string) => string,
): void {
  const state = room.state;
  if (!state) return;
  const botName = state.players[state.currentPlayerIndex]?.name ?? 'Bot';
  for (const player of room.players) {
    if (!player.isConnected || player.isBot) continue;
    const text = builder(player.locale, botName);
    if (!text) continue;
    emitToPlayer(io, room, player.id, (sock) => {
      sock.emit('toast', { message: text });
    });
  }
}

function emitToPlayer(
  io: IOServer,
  room: Room,
  playerId: string,
  emit: (socket: IOSocket) => void,
): boolean {
  for (const [, sock] of io.sockets.sockets) {
    if (!sock.rooms.has(room.code)) continue;
    const info = getRoomBySocket(sock.id);
    if (info && info.playerId === playerId) {
      emit(sock);
      return true;
    }
  }
  return false;
}

function clearRoomTurnTimer(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = undefined;
  }
}

function clearRoomDisconnectGrace(room: Room): void {
  clearDisconnectGraceTimer(room);
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
  // No delay — the bot-offer is available the moment the host is alone.
  // Previously this was a 15s wait (later 3s) to give a chance for a friend
  // to join before suggesting a bot; users found it annoying, so it was
  // removed entirely. If a countdown is ever wanted, re-introduce via a
  // positive BOT_OFFER_DELAY_MS + setTimeout.
  if (BOT_OFFER_DELAY_MS <= 0) {
    room.lobbyStatus = 'bot_offer';
    room.botOfferAt = null;
    emitLobbyStatus(io, room);
    return;
  }
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
  syncRoomTableStatus(room);
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
  maybeRecordMatch(room);
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
  maybeRecordMatch(room);
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

/** בוט משתמש לכל היותר בקלף פעולה/סלינדה אחד במשבצת 0 */
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

function handleBotDefense(io: IOServer, room: Room, state: ServerGameState): void {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const divisibleCard = hand.find((card) => card.type === 'number' && (card.value ?? 0) > 0 && (card.value ?? 0) % state.fractionPenalty === 0);
  if (divisibleCard) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'defendFractionSolveNumber',
        name,
        card: cardLabelForLocale(state, divisibleCard.id, locale),
        penalty: String(state.fractionPenalty),
      }),
    );
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, divisibleCard.id));
    return;
  }

  const wildCard = hand.find((card) => card.type === 'wild');
  if (wildCard) {
    const wildResolve = Math.max(state.fractionPenalty, 1);
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'defendFractionSolveWild',
        name,
        card: cardLabelForLocale(state, wildCard.id, locale),
        value: String(wildResolve),
        penalty: String(state.fractionPenalty),
      }),
    );
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, wildCard.id, wildResolve));
    return;
  }

  const counterFraction = hand.find((card) => card.type === 'fraction');
  if (counterFraction) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'playFractionBlock',
        name,
        card: cardLabelForLocale(state, counterFraction.id, locale),
      }),
    );
    applyBotState(io, room, (currentState) => playFraction(currentState, counterFraction.id));
    return;
  }

  emitBotStepToast(io, room, (locale, name) =>
    botNarrationText(locale, { kind: 'defendFractionPenalty', name, penalty: String(state.fractionPenalty) }),
  );
  applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
}

function handleBotPreRoll(io: IOServer, room: Room, state: ServerGameState): void {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const identicalCard = hand.find((card) => validateIdenticalPlay(card, topDiscard));
  if (identicalCard) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, {
        kind: 'playIdentical',
        name,
        card: cardLabelForLocale(state, identicalCard.id, locale),
      }),
    );
    applyBotState(io, room, (currentState) => playIdentical(currentState, identicalCard.id));
    return;
  }

  const attackFraction = hand.find((card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard));
  if (attackFraction) {
    emitBotStepToast(io, room, (locale) => {
      const denom = Number(String(attackFraction.fraction ?? '').split('/')[1] ?? 0) || 1;
      const topVisibleValue =
        topDiscard?.resolvedValue ??
        (topDiscard?.type === 'number' ? (topDiscard.value ?? null) : null);
      const divideX = topVisibleValue ?? state.pendingFractionTarget ?? denom;
      return botNarrationText(locale, {
        kind: 'playFractionAttack',
        x: String(divideX),
        y: String(Math.max(1, denom)),
      });
    });
    applyBotState(io, room, (currentState) => playFraction(currentState, attackFraction.id));
    return;
  }

  emitBotStepToast(io, room, (locale, name) =>
    botNarrationText(locale, { kind: 'rollDice', name }),
  );
  applyBotState(io, room, (currentState) => doRollDice(currentState));
}

function handleBotBuilding(io: IOServer, room: Room, state: ServerGameState): void {
  const pending = state.botPendingStagedIds;
  if (pending != null && state.phase === 'solved' && !state.hasPlayedCards) {
    if (pending.length > 0) {
      const cardId = pending[0]!;
      emitBotStepToast(io, room, (locale, name) => {
        const type = cardTypeInCurrentHand(state, cardId);
        const card = cardLabelForLocale(state, cardId, locale);
        if (type === 'number') return botNarrationText(locale, { kind: 'stageNumber', name, card });
        if (type === 'wild') return botNarrationText(locale, { kind: 'stageWild', name, card });
        if (type === 'operation') return botNarrationText(locale, { kind: 'stageOperation', name, card });
        return botNarrationText(locale, { kind: 'stageCard', name, card });
      });
      applyBotState(io, room, (s) => {
        const r = stageCard(s, cardId);
        if ('error' in r) return r;
        return { ...r, botPendingStagedIds: pending.slice(1) };
      });
      return;
    }
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'confirmStaged', name }),
    );
    applyBotState(io, room, (s) => {
      const r = confirmStaged(s);
      if ('error' in r) return r;
      return { ...r, botPendingStagedIds: null };
    });
    return;
  }

  const diff: BotDifficulty = state.hostGameSettings.botDifficulty ?? 'medium';
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const equationCommits = buildBotCommits(state);
  const commitIds = new Set(equationCommits.map((c) => c.cardId));
  const candidates = hand.filter(
    (card) =>
      (card.type === 'number' || card.type === 'wild' || card.type === 'operation') &&
      !commitIds.has(card.id),
  );
  const picked = pickBotStagedPlan(
    state.validTargets,
    candidates,
    equationCommits,
    state.hostGameSettings.mathRangeMax ?? 25,
    validateStagedCards,
    diff,
  );
  if (!picked) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'drawCard', name }),
    );
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  emitBotStepToast(io, room, (locale, name) => {
    const jokerCommit = picked.equationCommits.find((c) => c.jokerAs != null);
    const operationCommit = picked.equationCommits.find((c) => {
      const card = state.players[state.currentPlayerIndex]?.hand.find((h) => h.id === c.cardId);
      return card?.type === 'operation';
    });
    return botNarrationText(locale, {
      kind: 'confirmEquation',
      name,
      equation: picked.equationDisplay,
      target: String(picked.target),
      jokerOp: jokerCommit ? String(jokerCommit.jokerAs ?? '+') : undefined,
      operationLabel: operationCommit ? cardLabelForLocale(state, operationCommit.cardId, locale) : undefined,
    });
  });
  const equationOk = applyBotState(io, room, (currentState) =>
    confirmEquation(currentState, picked.target, picked.equationDisplay, picked.equationCommits),
  );
  if (!equationOk || !room.state) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'drawCard', name }),
    );
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  if (picked.stagedCardIds.length === 0) {
    emitBotStepToast(io, room, (locale, name) =>
      botNarrationText(locale, { kind: 'confirmStaged', name }),
    );
    applyBotState(io, room, (currentState) => confirmStaged(currentState));
    return;
  }

  applyBotState(io, room, (s) => ({ ...s, botPendingStagedIds: [...picked.stagedCardIds] }));
}

function runBotStep(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  switch (room.state.phase) {
    case 'turn-transition':
      emitBotStepToast(io, room, (locale, name) =>
        botNarrationText(locale, { kind: 'beginTurn', name }),
      );
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
      if (room.state.botPendingStagedIds != null) {
        handleBotBuilding(io, room, room.state);
      } else {
        emitBotStepToast(io, room, (locale, name) =>
          botNarrationText(locale, { kind: 'endTurn', name }),
        );
        applyBotState(io, room, (state) => doEndTurn(state));
      }
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

  const diff: BotDifficulty = room.state.hostGameSettings.botDifficulty ?? 'medium';
  const { min, max } = botStepDelayRange(diff);
  const delay = min + randomInt(0, Math.max(1, max - min + 1));
  room.botActionTimer = setTimeout(() => runBotStep(io, room), delay);
}

/**
 * Fire-and-forget: persist match result to Supabase when the game reaches
 * 'game-over'. Idempotent via `room.matchRecorded` guard.
 */
function maybeRecordMatch(room: Room): void {
  if (!room.state || room.state.phase !== 'game-over') return;
  if (room.matchRecorded) return;
  room.matchRecorded = true;

  const state = room.state;
  const humanPlayers = room.players.filter((p) => !p.isBot);
  if (humanPlayers.length === 0) return; // solo-bot practice — nothing to record

  const gameWinnerId = state.winner?.id ?? null;
  const coinsEarned = state.courageCoins ?? 0;

  // Only record authenticated players; skip guests (supabaseUserId is undefined)
  const authenticatedPlayers = humanPlayers.filter((p) => !!p.supabaseUserId);
  if (authenticatedPlayers.length === 0) return; // all guests — nothing to record

  const participants = authenticatedPlayers.map((p) => {
    const isWinner = p.id === gameWinnerId;
    const abandoned = !p.isConnected && !isWinner;
    const delta = abandoned
      ? -RATING_ABANDON_PENALTY
      : isWinner
        ? RATING_WIN
        : -RATING_LOSS;
    return { playerId: p.supabaseUserId!, delta, abandoned, coinsEarned: abandoned ? 0 : coinsEarned };
  });

  // Resolve winnerId to supabase UID for the match record
  const winnerPlayer = gameWinnerId ? authenticatedPlayers.find((p) => p.id === gameWinnerId) : null;
  const winnerId = winnerPlayer?.supabaseUserId ?? null;

  recordMatch({
    roomCode: room.code,
    difficulty: state.difficulty ?? null,
    playerCount: humanPlayers.length,
    startedAt: new Date(room.gameStartedAt ?? room.createdAt),
    winnerId,
    participants,
  }).catch((err) => console.error('[socketHandlers] maybeRecordMatch failed:', err));
}

function startRoomGame(
  io: IOServer,
  room: Room,
  difficulty: 'easy' | 'full',
  gameSettings?: Partial<HostGameSettings>,
): void {
  clearRoomCountdown(room);
  room.state = startGame(room, difficulty, gameSettings);
  room.gameStartedAt = Date.now();
  room.matchRecorded = false;
  room.lastActivity = Date.now();
  clearRoomDisconnectGrace(room);
  syncRoomTableStatus(room);
  room.lobbyStatus = hasBot(room) ? 'bot_game_started' : 'waiting_for_player';
  room.botOfferAt = null;
  emitLobbyStatus(io, room);
  io.to(room.code).emit('table_status_changed', {
    roomCode: room.code,
    status: room.tableStatus,
    countdownEndsAt: room.countdownEndsAt,
  });
  emitTablesUpdated(io);
  sendGameStarted(io, room);
  scheduleRoomTurnTimer(io, room);
  scheduleBotAction(io, room);
}

function handleWaitingRoomRosterChange(io: IOServer, room: Room): void {
  const humanCount = room.players.filter((player) => !player.isBot).length;
  if (room.countdownEndsAt != null && humanCount < 2) {
    clearRoomCountdown(room);
    io.to(room.code).emit('table_status_changed', {
      roomCode: room.code,
      status: room.tableStatus,
      countdownEndsAt: null,
    });
  }
  syncRoomTableStatus(room);
  emitTablesUpdated(io);
}

function startTableCountdown(io: IOServer, room: Room): void {
  const difficulty = room.configuredDifficulty;
  if (!difficulty) return;
  const countdownEndsAt = startRoomCountdown(room, TABLE_START_COUNTDOWN_MS);
  io.to(room.code).emit('table_countdown_started', { roomCode: room.code, countdownEndsAt });
  io.to(room.code).emit('table_status_changed', {
    roomCode: room.code,
    status: room.tableStatus,
    countdownEndsAt,
  });
  emitTablesUpdated(io);
  setRoomCountdownTimer(
    room,
    setTimeout(() => {
      setRoomCountdownTimer(room, null);
      if (room.state) return;
      if (room.players.filter((player) => !player.isBot).length < 2) {
        clearRoomCountdown(room);
        syncRoomTableStatus(room);
        io.to(room.code).emit('table_status_changed', {
          roomCode: room.code,
          status: room.tableStatus,
          countdownEndsAt: null,
        });
        emitTablesUpdated(io);
        return;
      }
      startRoomGame(io, room, difficulty, room.configuredGameSettings ?? undefined);
    }, TABLE_START_COUNTDOWN_MS),
  );
}

export function registerSocketHandlers(io: IOServer, socket: IOSocket): void {
  /** Rate-limit guard — returns true if the request should be blocked */
  function rateLimited(): boolean {
    if (!checkRateLimit(socket.id)) {
      console.warn(`[SECURITY] Rate limit exceeded: ${socket.id}`);
      socket.emit('error', { message: 'Too many requests' });
      return true;
    }
    return false;
  }

  socket.on('list_tables', () => {
    emitTablesUpdated(io, socket);
  });

  socket.on('create_table', async ({ playerName, locale }) => {
    if (rateLimited()) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const loc = validateLocale(locale);
    const { room, playerId } = createRoom(name, socket.id, loc);
    const creatingPlayer = room.players.find((p) => p.id === playerId);
    if (creatingPlayer) creatingPlayer.supabaseUserId = socket.data.userId ?? undefined;
    if (socket.data.userId) {
      room.tableTheme = await fetchPlayerActiveTableTheme(socket.data.userId);
    }
    socket.join(room.code);
    socket.emit('room_created', {
      roomCode: room.code,
      playerId,
      inviteCode: room.inviteCode,
      visibility: room.tableVisibility,
    });
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    emitTablesUpdated(io);
  });

  socket.on('configure_table', ({ visibility, maxParticipants, difficulty, gameSettings }) => {
    if (rateLimited()) return;
    const diff = validateDifficulty(difficulty);
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!diff) {
      socket.emit('error', { message: 'Invalid difficulty' });
      return;
    }
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyStart') });
      return;
    }
    configureRoomTable(room, {
      visibility: normalizeTableVisibility(visibility),
      maxParticipants,
      difficulty: diff,
      gameSettings: normalizeGameSettingsPatch(gameSettings),
    });
    socket.emit('room_created', {
      roomCode: room.code,
      playerId,
      inviteCode: room.inviteCode,
      visibility: room.tableVisibility,
    });
    refreshLobbyStatus(io, room);
    emitTablesUpdated(io);
  });

  socket.on('join_table', ({ roomCode, playerName, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const name = sanitizePlayerName(playerName);
    const loc = validateLocale(locale);
    if (!code) {
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const result = joinRoom(code, name, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    markRandomJoiner(room);
    const joiningPlayer = room.players.find((p) => p.id === playerId);
    if (joiningPlayer) joiningPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    socket.emit('room_created', {
      roomCode: room.code,
      playerId,
      inviteCode: null,
      visibility: room.tableVisibility,
    });
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    handleWaitingRoomRosterChange(io, room);
  });

  socket.on('join_private_table_with_code', ({ roomCode, inviteCode, playerName, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const safeInvite = String(inviteCode ?? '').trim();
    const name = sanitizePlayerName(playerName);
    const loc = validateLocale(locale);
    if (!code) {
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const result = joinPrivateRoom(code, safeInvite, name, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    const joiningPlayer = room.players.find((p) => p.id === playerId);
    if (joiningPlayer) joiningPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    socket.emit('room_created', {
      roomCode: room.code,
      playerId,
      inviteCode: null,
      visibility: room.tableVisibility,
    });
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    handleWaitingRoomRosterChange(io, room);
  });

  socket.on('start_table_countdown', () => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyCountdown') });
      return;
    }
    if (room.players.filter((player) => !player.isBot).length < 2) {
      socket.emit('error', { message: t(loc, 'game.minTwoPlayers') });
      return;
    }
    if (!room.configuredDifficulty) {
      socket.emit('error', { message: t(loc, 'game.tableNotConfigured') });
      return;
    }
    if (room.countdownEndsAt != null) {
      socket.emit('error', { message: t(loc, 'game.countdownAlreadyRunning') });
      return;
    }
    startTableCountdown(io, room);
  });

  socket.on('create_room', ({ playerName, locale }) => {
    if (rateLimited()) return;
    const name = sanitizePlayerName(playerName);
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const loc = validateLocale(locale);
    const { room, playerId } = createRoom(name, socket.id, loc);
    const creatingPlayer = room.players.find((p) => p.id === playerId);
    if (creatingPlayer) creatingPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    socket.emit('room_created', {
      roomCode: room.code,
      playerId,
      inviteCode: room.inviteCode,
      visibility: room.tableVisibility,
    });
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    emitTablesUpdated(io);
  });

  socket.on('join_room', ({ roomCode, playerName, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const name = sanitizePlayerName(playerName);
    const loc = validateLocale(locale);
    if (!code) {
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    if (!name) {
      socket.emit('error', { message: 'Invalid player name' });
      return;
    }
    const result = joinRoom(code, name, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, playerId } = result;
    const joiningPlayer = room.players.find((p) => p.id === playerId);
    if (joiningPlayer) joiningPlayer.supabaseUserId = socket.data.userId ?? undefined;
    socket.join(room.code);
    socket.emit('room_created', {
      roomCode: room.code,
      playerId,
      inviteCode: null,
      visibility: room.tableVisibility,
    });
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    handleWaitingRoomRosterChange(io, room);
  });

  socket.on('leave_room', () => {
    if (rateLimited()) return;
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    socket.leave(room.code);
    io.to(room.code).emit('player_left', { playerId, playerName });
    // If a game is in progress and a human left, the remaining player
    // wins immediately (technical victory — no grace period, no bot offer).
    if (room.state && room.state.phase !== 'game-over') {
      const tvResult = technicalVictory(room.state, playerId);
      if (tvResult) {
        room.state = tvResult;
        clearRoomDisconnectGrace(room);
        clearRoomTurnTimer(room);
        clearBotActionTimer(room);
        broadcastState(io, room);
        emitRoomToasts(io, room);
        maybeRecordMatch(room);
      }
    }
    if (room.players.length > 0) {
      clearRoomDisconnectGrace(room);
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
      handleWaitingRoomRosterChange(io, room);
    } else {
      emitTablesUpdated(io);
    }
  });

  socket.on('reconnect', ({ roomCode, playerId, locale }) => {
    if (rateLimited()) return;
    const code = validateRoomCode(roomCode);
    const pid = validatePlayerId(playerId);
    const loc = validateLocale(locale);
    if (!code || !pid) {
      console.warn(`[SECURITY] Invalid reconnect attempt: room=${roomCode} player=${playerId} socket=${socket.id}`);
      socket.emit('error', { message: t(loc, 'room.notFound') });
      return;
    }
    const result = reconnectPlayer(code, pid, socket.id, loc);
    if ('error' in result) {
      socket.emit('error', { message: t(loc, result.error.key, result.error.params) });
      return;
    }
    const { room, player } = result;
    if (socket.data.userId) player.supabaseUserId = socket.data.userId;
    socket.join(room.code);
    if (room.disconnectedPlayerId === player.id) {
      clearRoomDisconnectGrace(room);
      room.lastActivity = Date.now();
      for (const other of room.players) {
        if (other.id === player.id || other.isBot || !other.isConnected) continue;
        emitToPlayer(io, room, other.id, (peerSocket) => {
          peerSocket.emit('opponent_reconnected', { playerId: player.id, playerName: player.name });
        });
      }
    }
    if (room.state) {
      room.state = withOnlineTurnDeadline(room.state);
      socket.emit('state_update', getPlayerView(room.state, playerId, player.locale));
      scheduleRoomTurnTimer(io, room);
    }
    emitRoomPlayers(io, room);
    refreshLobbyStatus(io, room);
    handleWaitingRoomRosterChange(io, room);
    scheduleBotAction(io, room);
  });

  socket.on('start_game', ({ difficulty, gameSettings }) => {
    if (rateLimited()) return;
    const diff = validateDifficulty(difficulty);
    if (!diff) {
      socket.emit('error', { message: 'Invalid difficulty' });
      return;
    }
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

    startRoomGame(io, room, diff, normalizeGameSettingsPatch(gameSettings));
  });

  socket.on('start_bot_game', ({ difficulty, gameSettings }, ack) => {
    if (rateLimited()) return;
    const diff = validateDifficulty(difficulty);
    const reply = (result: StartBotGameAck) => {
      if (typeof ack === 'function') ack(result);
    };
    if (!diff) {
      socket.emit('error', { message: 'Invalid difficulty' });
      reply({ ok: false, message: 'Invalid difficulty' });
      return;
    }
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

    const normalizedSettings = normalizeGameSettingsPatch(gameSettings);
    addBotPlayer(room, loc, normalizedSettings?.botDisplayName);
    emitRoomPlayers(io, room);
    startRoomGame(io, room, diff, normalizedSettings);
    if (!room.state) {
      const message = t(loc, 'game.notStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    const playerView = getPlayerView(room.state, playerId, playerLocale(room, playerId));
    reply({ ok: true, playerView });
  });

  socket.on('continue_vs_bot', (ack) => {
    if (rateLimited()) return;
    const reply = (result: ContinueVsBotAck) => {
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
    if (!room.state) {
      const message = t(loc, 'game.notStarted');
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }
    if (!room.disconnectedPlayerId || room.disconnectedPlayerId === playerId) {
      const message = loc === 'he' ? 'אין שחקן מנותק להחלפה בבוט.' : 'No disconnected opponent to replace with a bot.';
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    const target = room.players.find((player) => player.id === room.disconnectedPlayerId && !player.isBot);
    if (!target || target.isConnected) {
      const message = loc === 'he' ? 'השחקן כבר חזר או לא זמין להחלפה.' : 'Player already reconnected or unavailable for bot replacement.';
      socket.emit('error', { message });
      reply({ ok: false, message });
      return;
    }

    target.isBot = true;
    target.isConnected = true;
    target.isHost = false;
    target.name = target.locale === 'he' ? 'בוט' : 'Bot';
    clearRoomDisconnectGrace(room);
    room.state = withOnlineTurnDeadline(room.state);
    room.lastActivity = Date.now();

    emitRoomPlayers(io, room);
    broadcastState(io, room);
    scheduleRoomTurnTimer(io, room);
    scheduleBotAction(io, room);

    const playerView = getPlayerView(room.state, playerId, playerLocale(room, playerId));
    reply({ ok: true, playerView });
  });

  socket.on('begin_turn', () => {
    if (rateLimited()) return;
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

  socket.on('set_bot_difficulty', ({ difficulty }) => {
    if (rateLimited()) return;
    const info = getRoomBySocket(socket.id);
    const loc = info ? playerLocale(info.room, info.playerId) : 'he';
    if (!info) {
      socket.emit('error', { message: t(loc, 'game.noRoom') });
      return;
    }
    const { room, playerId } = info;
    if (!isHost(room, playerId)) {
      socket.emit('error', { message: t(loc, 'game.hostOnlyBotDifficulty') });
      return;
    }
    if (!room.state) {
      socket.emit('error', { message: t(loc, 'game.notStarted') });
      return;
    }
    if (!hasBot(room)) {
      socket.emit('error', { message: t(loc, 'game.noBotInRoom') });
      return;
    }
    const diff = normalizeBotDifficulty(difficulty);
    if (!BOT_DIFF_LEVELS.includes(diff)) {
      socket.emit('error', { message: t(loc, 'game.invalidBotDifficulty') });
      return;
    }
    room.state = {
      ...room.state,
      hostGameSettings: {
        ...room.state.hostGameSettings,
        botDifficulty: diff,
      },
    };
    room.lastActivity = Date.now();
    broadcastState(io, room);
  });

  socket.on('roll_dice', () => {
    if (rateLimited()) return;
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
    if (rateLimited()) return;
    const safeDisplay = sanitizeEquationDisplay(equationDisplay);
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      socket.emit('error', { message: 'Invalid equation result' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) =>
      confirmEquation(state, result, safeDisplay, equationCommits, equationCommit),
    );
  });

  socket.on('stage_card', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => stageCard(state, cid));
  });

  socket.on('unstage_card', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => unstageCard(state, cid));
  });

  socket.on('confirm_staged', () => {
    if (rateLimited()) return;
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
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playIdentical(state, cid));
  });

  socket.on('play_fraction', ({ cardId }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playFraction(state, cid));
  });

  socket.on('defend_fraction_solve', ({ cardId, wildResolve }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    // wildResolve validation happens inside defendFractionSolve (gameEngine checks range)
    applyAction(io, socket, room, playerId, (state) => defendFractionSolve(state, cid, wildResolve));
  });

  socket.on('defend_fraction_penalty', () => {
    if (rateLimited()) return;
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
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    if (!cid) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playOperation(state, cid));
  });

  socket.on('play_joker', ({ cardId, chosenOperation }) => {
    if (rateLimited()) return;
    const cid = validateCardId(cardId);
    const op = validateOperation(chosenOperation);
    if (!cid || !op) {
      socket.emit('error', { message: 'Invalid card or operation' });
      return;
    }
    const info = getRoomBySocket(socket.id);
    if (!info) return;
    const { room, playerId } = info;
    const canAct = canPlayerAct(room, playerId);
    if (!canAct.ok) {
      socket.emit('error', { message: t(playerLocale(room, playerId), canAct.reason.key, canAct.reason.params) });
      return;
    }
    applyAction(io, socket, room, playerId, (state) => playJoker(state, cid, op));
  });

  socket.on('draw_card', () => {
    if (rateLimited()) return;
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
    if (rateLimited()) return;
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
    cleanupRateLimit(socket.id);
    const result = leaveRoom(socket.id);
    if (!result) return;
    const { room, playerId, playerName } = result;
    io.to(room.code).emit('player_left', { playerId, playerName });
    if (room.state) {
      broadcastState(io, room);
      scheduleBotAction(io, room);
      if (shouldStartDisconnectGrace(room, playerId)) {
        const deadlineAt = setDisconnectGraceTimer(room, playerId, (timerRoom, disconnectedPlayerId) => {
          clearRoomTurnTimer(timerRoom);
          clearBotActionTimer(timerRoom);
          // Grace expired — opponent didn't return. End with technical
          // victory for the remaining player (no bot offer).
          if (timerRoom.state && timerRoom.state.phase !== 'game-over') {
            const tvResult = technicalVictory(timerRoom.state, disconnectedPlayerId);
            if (tvResult) {
              timerRoom.state = tvResult;
              broadcastState(io, timerRoom);
              emitRoomToasts(io, timerRoom);
              maybeRecordMatch(timerRoom);
              return;
            }
          }
          if (timerRoom.state) {
            timerRoom.state = { ...timerRoom.state, turnDeadlineAt: null };
            broadcastState(io, timerRoom);
          }
          const disconnectedPlayer = timerRoom.players.find((player) => player.id === disconnectedPlayerId);
          const disconnectedName = disconnectedPlayer?.name ?? 'Player';
          for (const other of timerRoom.players) {
            if (other.id === disconnectedPlayerId || other.isBot || !other.isConnected) continue;
            emitToPlayer(io, timerRoom, other.id, (peerSocket) => {
              peerSocket.emit('opponent_disconnect_expired', {
                playerId: disconnectedPlayerId,
                playerName: disconnectedName,
              });
            });
          }
        });

        for (const other of room.players) {
          if (other.id === playerId || other.isBot || !other.isConnected) continue;
          emitToPlayer(io, room, other.id, (peerSocket) => {
            peerSocket.emit('opponent_disconnect_grace', {
              playerId,
              playerName,
              deadlineAt,
            });
          });
        }
      }
    } else if (room.players.length > 0) {
      emitRoomPlayers(io, room);
      refreshLobbyStatus(io, room);
    }
  });
}
