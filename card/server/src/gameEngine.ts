// ============================================================
// server/src/gameEngine.ts — Game state machine
// Migrated from client-side useReducer in index.tsx
// ============================================================

import type {
  Card, Player, ServerGameState, PlayerView, Operation, Fraction,
  DiceResult, HostGameSettings, EquationCommitPayload, AppLocale, TournamentStanding,
} from '../../shared/types';
import type { GameStatusMessage, LastMovePayload, LocalizedMessage } from '../../shared/i18n';
import { formatGameMessage, formatLastMove } from '../../shared/i18n';
import { CARDS_PER_PLAYER } from '../../shared/gameConstants';

const DEFAULT_HOST_GAME_SETTINGS: HostGameSettings = {
  diceMode: '3',
  showFractions: true,
  showPossibleResults: true,
  showSolveExercise: true,
  mathRangeMax: 25,
  enabledOperators: ['x', '÷'],
  allowNegativeTargets: true,
  difficultyStage: 'H',
  fractionKinds: ['1/2', '1/3', '1/4', '1/5'],
  abVariant: 'variant_0_15_plus',
  timerSetting: 'off',
  timerCustomSeconds: 60,
  botDifficulty: 'medium',
};
import { generateDeck, shuffle, dealCards } from './deck';
import {
  fractionDenominator, validateIdenticalPlay,
  validateFractionPlay, validateStagedCards,
  getEffectiveNumber, resolveDiscardNumberCardFromStaged,
  rollDice, isTriple, generateValidTargets,
} from './equations';
import type { Room } from './roomManager';
import { randomInt, randomUUID } from 'node:crypto';

function locMsg(key: string, params?: Record<string, string | number>): LocalizedMessage {
  return { key, params };
}

function locErr(key: string, params?: Record<string, string | number>): { error: LocalizedMessage } {
  return { error: { key, params } };
}

/** ASCII-friendly card label for toasts (sentence is localized; label is readable in both locales). */
function identicalCardLabel(
  card: Card,
  effectiveVal: number | null,
): string {
  if (card.type === 'number') return String(card.value ?? '');
  if (card.type === 'fraction') return String(card.fraction ?? '');
  if (card.type === 'operation') return String(card.operation ?? '');
  if (card.type === 'wild') return effectiveVal != null ? `Wild(${effectiveVal})` : 'Wild';
  return 'Joker';
}

/** זמן המתנה לפעולת שחקן במשחק מקוון (אני מוכן) */
export const ONLINE_TURN_ACTION_MS = 15_000;

function resolveConfiguredTurnTimerSeconds(st: ServerGameState): number | null {
  const cfg = st.hostGameSettings?.timerSetting ?? 'off';
  if (cfg === '30') return 30;
  if (cfg === '60') return 60;
  if (cfg === 'custom') {
    const custom = Math.max(1, Number(st.hostGameSettings?.timerCustomSeconds ?? 60));
    return custom;
  }
  return null;
}

export function withOnlineTurnDeadline(st: ServerGameState): ServerGameState {
  if (st.phase === 'turn-transition') {
    return { ...st, turnDeadlineAt: Date.now() + ONLINE_TURN_ACTION_MS };
  }
  const configuredSeconds = resolveConfiguredTurnTimerSeconds(st);
  // In online game:
  // - If host enabled turn timer -> use only configured timer.
  // - If host timer is off -> fallback safety timeout after dice roll (60s).
  const isPostRollWindow =
    (st.phase === 'building' || st.phase === 'solved') &&
    st.dice !== null &&
    !st.hasPlayedCards;
  if (configuredSeconds !== null && isPostRollWindow) {
    return { ...st, turnDeadlineAt: Date.now() + configuredSeconds * 1000 };
  }
  if (configuredSeconds === null && isPostRollWindow) {
    return { ...st, turnDeadlineAt: Date.now() + 60_000 };
  }
  return { ...st, turnDeadlineAt: null };
}

function isActivePlayer(player: Player): boolean {
  return !player.isEliminated && !player.isSpectator;
}

function getNextActivePlayerIndex(players: Player[], fromIndex: number): number {
  if (players.length === 0) return fromIndex;
  for (let step = 1; step <= players.length; step++) {
    const idx = (fromIndex + step) % players.length;
    if (isActivePlayer(players[idx])) return idx;
  }
  return fromIndex;
}

function getActivePlayers(players: Player[]): Player[] {
  return players.filter(isActivePlayer);
}

const COURAGE_STEP_TO_PERCENT: Readonly<Record<number, number>> = {
  0: 0,
  1: 33,
  2: 66,
  3: 100,
};

function clampCourageStep(step: number): number {
  return Math.max(0, Math.min(3, step));
}

function applyCourageStepReward(st: ServerGameState): ServerGameState {
  const nextStep = clampCourageStep((st.courageMeterStep ?? 0) + 1);
  if (nextStep === (st.courageMeterStep ?? 0)) return st;
  return {
    ...st,
    courageMeterStep: nextStep,
    courageMeterPercent: COURAGE_STEP_TO_PERCENT[nextStep],
    courageRewardPulseId: (st.courageRewardPulseId ?? 0) + 1,
  };
}

function applyCourageRewards(
  st: ServerGameState,
  options: { equationSuccess?: boolean; discardSuccess?: boolean },
): ServerGameState {
  let next = st;
  if (options.equationSuccess) {
    next = applyCourageStepReward(next);
  }
  if (options.discardSuccess) {
    const currentStreak = next.courageDiscardSuccessStreak ?? 0;
    const incremented = currentStreak + 1;
    if (incremented >= 2) {
      next = applyCourageStepReward({ ...next, courageDiscardSuccessStreak: 0 });
    } else {
      next = { ...next, courageDiscardSuccessStreak: incremented };
    }
  }
  return next;
}

// ── Helper: draw N cards from draw pile for a player ──

function reshuffleDiscard(st: ServerGameState): ServerGameState {
  if (st.drawPile.length > 0 || st.discardPile.length <= 1) return st;
  const top = st.discardPile[st.discardPile.length - 1];
  return { ...st, drawPile: shuffle(st.discardPile.slice(0, -1)), discardPile: [top] };
}

function drawFromPile(st: ServerGameState, count: number, pi: number): ServerGameState {
  let s = { ...st, players: st.players.map(p => ({ ...p, hand: [...p.hand] })) };
  for (let i = 0; i < count; i++) {
    s = reshuffleDiscard(s);
    if (s.drawPile.length === 0) break;
    s.players[pi].hand.push(s.drawPile[0]);
    s.drawPile = s.drawPile.slice(1);
  }
  return s;
}

// ── Check win condition ──

function bumpTournamentOnWin(st: ServerGameState, winnerIndex: number): TournamentStanding[] {
  const t = st.tournamentTable;
  if (!t?.length) return t ?? [];
  return t.map((row) =>
    row.playerIndex === winnerIndex
      ? { ...row, wins: row.wins + 1 }
      : { ...row, losses: row.losses + 1 },
  );
}

function checkWin(st: ServerGameState): ServerGameState {
  const cp = st.players[st.currentPlayerIndex];
  if (cp.hand.length <= 2) {
    const wi = st.currentPlayerIndex;
    return {
      ...st,
      phase: 'game-over',
      winner: cp,
      tournamentTable: bumpTournamentOnWin(st, wi),
    };
  }
  if (cp.hand.length === 3) {
    const warn = locMsg('toast.threeCardsLeft', { name: cp.name });
    const mergedToast: LastMovePayload = st.lastMoveMessage
      ? Array.isArray(st.lastMoveMessage)
        ? [...st.lastMoveMessage, warn]
        : [st.lastMoveMessage, warn]
      : warn;
    return { ...st, lastMoveMessage: mergedToast, message: warn };
  }
  return st;
}

// ── End turn logic ──

function endTurnLogic(st: ServerGameState): ServerGameState {
  let s = { ...st };
  const next = getNextActivePlayerIndex(s.players, s.currentPlayerIndex);
  const prevRounds = s.roundsPlayed ?? 0;
  return {
    ...s,
    players: s.players.map(p => ({ ...p, calledLolos: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    stagedCards: [], equationResult: null, validTargets: [],
    hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
    pendingFractionTarget: null, fractionPenalty: 0,
    equationCommits: [],
    botPendingStagedIds: null,
    roundsPlayed: prevRounds + 1,
  };
}

// ── Find a card in current player's hand ──

function findCard(state: ServerGameState, cardId: string): Card | undefined {
  const cp = state.players[state.currentPlayerIndex];
  return cp.hand.find(c => c.id === cardId);
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API — Game Actions
// ══════════════════════════════════════════════════════════════

export function startGame(
  room: Room,
  difficulty: 'easy' | 'full',
  partialSettings?: Partial<HostGameSettings>,
): ServerGameState {
  const mergedHost: HostGameSettings = {
    ...DEFAULT_HOST_GAME_SETTINGS,
    ...partialSettings,
  };
  const lowRange = mergedHost.mathRangeMax === 12;
  const showFractions = lowRange ? false : mergedHost.showFractions !== false;
  const fk: Fraction[] = lowRange
    ? []
    : mergedHost.fractionKinds && mergedHost.fractionKinds.length > 0
      ? mergedHost.fractionKinds
      : (['1/2', '1/3', '1/4', '1/5'] as Fraction[]);
  const hostGameSettings: HostGameSettings = {
    ...mergedHost,
    showFractions,
    fractionKinds: showFractions ? fk : [],
  };
  const deck = shuffle(
    generateDeck(
      difficulty,
      showFractions,
      hostGameSettings.enabledOperators,
      hostGameSettings.mathRangeMax,
      showFractions ? fk : null,
    ),
  );
  const { hands, remaining } = dealCards(deck, room.players.length, CARDS_PER_PLAYER);
  let drawPile = remaining;

  // Find first number card for discard pile
  let firstDiscard: Card | undefined;
  for (let i = 0; i < drawPile.length; i++) {
    if (drawPile[i].type === 'number') {
      firstDiscard = drawPile[i];
      drawPile = [...drawPile.slice(0, i), ...drawPile.slice(i + 1)];
      break;
    }
  }
  if (!firstDiscard) { firstDiscard = drawPile[0]; drawPile = drawPile.slice(1); }

  // Deal hands to players
  const players: Player[] = room.players.map((p, i) => ({
    ...p,
    hand: hands[i],
    calledLolos: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
  }));

  const firstIdx = randomInt(0, players.length);
  const openingDrawId = randomUUID();

  const initial: ServerGameState = {
    roomCode: room.code,
    phase: 'turn-transition',
    players,
    currentPlayerIndex: firstIdx,
    drawPile,
    discardPile: firstDiscard ? [firstDiscard] : [],
    dice: null,
    diceRollSeq: 0,
    validTargets: [],
    equationResult: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: false,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    courageMeterPercent: 0,
    courageMeterStep: 0,
    courageDiscardSuccessStreak: 0,
    courageRewardPulseId: 0,
    identicalCelebration: null,
    lastMoveMessage: null,
    lastEquationDisplay: null,
    difficulty,
    hostGameSettings,
    winner: null,
    message: '' as GameStatusMessage,
    openingDrawId,
    turnDeadlineAt: null,
    roundsPlayed: 0,
    equationCommits: [],
    botPendingStagedIds: null,
    tournamentTable: players.map((p, i) => ({
      playerIndex: i,
      playerName: p.name,
      wins: 0,
      losses: 0,
    })),
  };
  return withOnlineTurnDeadline(initial);
}

export function beginTurn(st: ServerGameState): ServerGameState {
  if (st.pendingFractionTarget !== null && !st.fractionAttackResolved) {
    return {
      ...st,
      phase: 'pre-roll',
      message: locMsg('toast.fractionDefenseRequired', {
        target: st.pendingFractionTarget,
        penalty: st.fractionPenalty,
      }),
    };
  }
  return {
    ...st,
    phase: 'pre-roll',
    fractionAttackResolved: false,
    pendingFractionTarget: null,
    fractionPenalty: 0,
    message: '',
  };
}

export function doRollDice(st: ServerGameState): ServerGameState | { error: LocalizedMessage } {
  if (st.phase !== 'pre-roll') return locErr('dice.cannotRollNow');
  const dice = rollDice();
  let ns: ServerGameState = { ...st, dice };
  let statusMsg: GameStatusMessage = '';

  if (isTriple(dice)) {
    let s = { ...ns, players: ns.players.map(p => ({ ...p, hand: [...p.hand] })) };
    for (let i = 0; i < s.players.length; i++)
      if (i !== st.currentPlayerIndex) s = drawFromPile(s, dice.die1, i);
    statusMsg = locMsg('toast.tripleDice', { n: dice.die1 });
    ns = s;
  }

  const vt = generateValidTargets(
    dice,
    st.hostGameSettings.enabledOperators,
    st.hostGameSettings.allowNegativeTargets ?? false,
    st.hostGameSettings.mathRangeMax ?? 12,
  );
  return {
    ...ns,
    validTargets: vt,
    phase: 'building',
    diceRollSeq: (st.diceRollSeq ?? 0) + 1,
    consecutiveIdenticalPlays: 0,
    equationCommits: [],
    message: statusMsg,
    botPendingStagedIds: null,
  };
}

/** דילוג תור אם השחקן לא הגיב בזמן — קנס ושליפה + מעבר לשחקן הבא */
export function forceTurnTimeout(st: ServerGameState): ServerGameState | { error: LocalizedMessage } {
  const isTurnTransitionTimeout = st.phase === 'turn-transition';
  const isInTurnTimeout = (st.phase === 'building' || st.phase === 'solved');
  if (!isTurnTransitionTimeout && !isInTurnTimeout) {
    return locErr('timer.notActivePhase');
  }

  // During active turn (after roll): end turn by existing rules.
  // doEndTurn already applies penalties/rules for "no move".
  if (isInTurnTimeout) {
    const cp = st.players[st.currentPlayerIndex];
    const ended = doEndTurn(st);
    return {
      ...ended,
      lastMoveMessage: locMsg('toast.turnTimeoutEnded', {
        name: cp?.name ?? '…',
      }),
      message: '',
    };
  }

  const skippedIdx = st.currentPlayerIndex;
  const skippedPlayer = st.players[skippedIdx];
  const skippedName = skippedPlayer?.name ?? '…';
  if (!skippedPlayer) return locErr('timer.currentPlayerNotFound');

  const nextWarnings = (skippedPlayer.afkWarnings ?? 0) + 1;
  const playersAfterWarning = st.players.map((p, idx) =>
    idx === skippedIdx ? { ...p, afkWarnings: nextWarnings } : p
  );

  if (nextWarnings >= 3) {
    const playersAfterElimination = playersAfterWarning.map((p, idx) =>
      idx === skippedIdx ? { ...p, isEliminated: true, isSpectator: true } : p
    );
    const remainingActive = getActivePlayers(playersAfterElimination);
    if (remainingActive.length <= 1) {
      const winner = remainingActive[0] ?? null;
      const wi = winner ? playersAfterElimination.findIndex((p) => p.id === winner.id) : -1;
      const tournamentTable =
        wi >= 0 ? bumpTournamentOnWin({ ...st, players: playersAfterElimination, tournamentTable: st.tournamentTable }, wi) : st.tournamentTable;
      return {
        ...st,
        players: playersAfterElimination,
        phase: 'game-over',
        winner,
        tournamentTable,
        turnDeadlineAt: null,
        lastMoveMessage: locMsg('toast.playerEliminatedAfk', { name: skippedName }),
        message: remainingActive[0]
          ? locMsg('toast.winnerAfterKick', { winner: remainingActive[0].name, kicked: skippedName })
          : locMsg('toast.gameOverNoActive'),
      };
    }

    const nextAfterKick = getNextActivePlayerIndex(playersAfterElimination, skippedIdx);
    const nextNameAfterKick = playersAfterElimination[nextAfterKick]?.name ?? '…';
    return {
      ...st,
      players: playersAfterElimination.map((p) => ({ ...p, calledLolos: false })),
      currentPlayerIndex: nextAfterKick,
      phase: 'turn-transition',
      dice: null,
      validTargets: [],
      equationResult: null,
      stagedCards: [],
      equationCommits: [],
      hasPlayedCards: false,
      hasDrawnCard: false,
      lastCardValue: null,
      consecutiveIdenticalPlays: 0,
      message: '',
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: true,
      roundsPlayed: (st.roundsPlayed ?? 0) + 1,
      lastMoveMessage: locMsg('toast.eliminatedTurnTo', { name: skippedName, next: nextNameAfterKick }),
    };
  }

  const next = getNextActivePlayerIndex(playersAfterWarning, skippedIdx);
  const nextName = playersAfterWarning[next]?.name ?? '…';

  const penalized = drawFromPile({ ...st, players: playersAfterWarning }, 1, skippedIdx);
  const base = endTurnLogic(penalized);
  const tMsg = locMsg('toast.afkWarnPenalty', {
    name: skippedName,
    warn: nextWarnings,
    next: nextName,
  });
  return { ...base, lastMoveMessage: tMsg, message: '' };
}

function validateEquationCommitsPayload(
  st: ServerGameState,
  payloads: EquationCommitPayload[] | null | undefined,
): { error: LocalizedMessage } | { ok: true; commits: EquationCommitPayload[] } {
  if (payloads == null || payloads.length === 0) return { ok: true, commits: [] };
  if (payloads.length > 2) return locErr('equation.tooManyCommits');
  const seenPos = new Set<number>();
  const seenCard = new Set<string>();
  const out: EquationCommitPayload[] = [];
  for (const payload of payloads) {
    if (seenPos.has(payload.position)) return locErr('equation.duplicateOpPosition');
    if (seenCard.has(payload.cardId)) return locErr('equation.duplicateCommitCard');
    seenPos.add(payload.position);
    seenCard.add(payload.cardId);
    const card = findCard(st, payload.cardId);
    if (!card) return locErr('equation.commitCardNotInHand');
    if (card.type !== 'operation' && card.type !== 'joker') return locErr('equation.invalidCommitCard');
    if (payload.position !== 0 && payload.position !== 1) return locErr('equation.invalidOpPosition');
    if (card.type === 'joker') {
      if (payload.jokerAs == null) return locErr('equation.chooseJokerOp');
    } else if (payload.jokerAs != null) {
      return locErr('equation.regularOpNoJoker');
    }
    out.push({ cardId: payload.cardId, position: payload.position, jokerAs: payload.jokerAs });
  }
  return { ok: true, commits: out };
}

export function confirmEquation(
  st: ServerGameState,
  result: number,
  equationDisplay: string,
  equationCommits?: EquationCommitPayload[] | null,
  /** @deprecated use equationCommits */
  equationCommit?: EquationCommitPayload | null,
): ServerGameState | { error: LocalizedMessage } {
  if (st.phase !== 'building') return locErr('equation.notBuildingPhase');
  if (!st.validTargets.some(t => t.result === result)) return locErr('equation.invalidResult');
  const raw =
    equationCommits != null && equationCommits.length > 0
      ? equationCommits
      : equationCommit != null
        ? [equationCommit]
        : [];
  const validated = validateEquationCommitsPayload(st, raw);
  if ('error' in validated) return validated;
  return {
    ...st,
    phase: 'solved',
    equationResult: result,
    lastEquationDisplay: equationDisplay,
    stagedCards: [],
    equationCommits: validated.commits,
    message: '',
  };
}

export function stageCard(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage } {
  if (st.phase !== 'solved' || st.hasPlayedCards) return locErr('stage.cannotStageNow');
  const card = findCard(st, cardId);
  if (!card) return locErr('stage.cardNotFound');
  if (st.stagedCards.some(c => c.id === card.id)) return locErr('stage.alreadyInStaging');
  if (card.type !== 'number' && card.type !== 'operation' && card.type !== 'wild') {
    return locErr('stage.onlyNumberWildOp');
  }
  if (card.type === 'wild' && st.stagedCards.some(c => c.type === 'wild')) {
    return locErr('stage.oneWildOnly');
  }
  if (card.type === 'operation' && st.stagedCards.some(c => c.type === 'operation')) {
    return locErr('stage.oneOpOnly');
  }
  const equationCommits = st.equationCommits.some((c) => c.cardId === cardId)
    ? st.equationCommits.filter((c) => c.cardId !== cardId)
    : st.equationCommits;
  return { ...st, equationCommits, stagedCards: [...st.stagedCards, card], message: '' };
}

export function unstageCard(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage } {
  if (st.phase !== 'solved') return locErr('unstage.wrongPhase');
  return { ...st, stagedCards: st.stagedCards.filter(c => c.id !== cardId), message: '' };
}

export function confirmStaged(st: ServerGameState): ServerGameState | { error: LocalizedMessage } {
  if (st.phase !== 'solved' || st.hasPlayedCards) return locErr('confirm.cannotConfirm');
  const stNumbers = st.stagedCards.filter(c => c.type === 'number' || c.type === 'wild');
  const stOpCards = st.stagedCards.filter(c => c.type === 'operation');
  const stOpCard = stOpCards.length === 1 ? stOpCards[0] : null;
  if (stNumbers.length === 0) return locErr('confirm.needNumberOrWild');
  if (st.equationResult === null) return locErr('confirm.noEquationResult');
  const maxWild = st.hostGameSettings?.mathRangeMax ?? 25;
  if (!validateStagedCards(stNumbers, stOpCard, st.equationResult, maxWild)) {
    return locErr('confirm.sumMismatch');
  }

  const stIds = new Set(st.stagedCards.map(c => c.id));
  for (const ec of st.equationCommits) stIds.add(ec.cardId);
  const stCp = st.players[st.currentPlayerIndex];
  const stNp = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: stCp.hand.filter(c => !stIds.has(c.id)) } : p);
  const discardDisplayCard = resolveDiscardNumberCardFromStaged(st.stagedCards, st.equationResult, maxWild);
  const lastCardVal = getEffectiveNumber(discardDisplayCard);
  const stDiscard = [...st.discardPile, discardDisplayCard];
  const stToast = locMsg('toast.equationPlayed', {
    name: stCp.name,
    equation: st.lastEquationDisplay || '',
    value: lastCardVal ?? '?',
  });

  let stNs: ServerGameState = {
    ...st, players: stNp, discardPile: stDiscard,
    stagedCards: [], consecutiveIdenticalPlays: 0,
    hasPlayedCards: true, lastCardValue: lastCardVal,
    lastMoveMessage: stToast, lastEquationDisplay: null,
    equationCommits: [],
    message: '',
  };
  stNs = applyCourageRewards(stNs, { equationSuccess: true, discardSuccess: true });
  stNs = checkWin(stNs);
  if (stNs.phase === 'game-over') return stNs;
  return endTurnLogic(stNs);
}

export function playIdentical(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage } {
  if (st.phase !== 'pre-roll') return locErr('identical.wrongPhase');
  if (st.consecutiveIdenticalPlays >= 2) return locErr('identical.identicalLimit');
  const card = findCard(st, cardId);
  if (!card) return locErr('stage.cardNotFound');
  const td = st.discardPile[st.discardPile.length - 1];
  if (!validateIdenticalPlay(card, td)) return locErr('identical.notMatchingTop');

  const effectiveVal = getEffectiveNumber(td);
  const cardToDiscard = card.type === 'wild' && effectiveVal != null
    ? { ...card, resolvedValue: effectiveVal }
    : card;

  const cp = st.players[st.currentPlayerIndex];
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  const newConsecutive = st.consecutiveIdenticalPlays + 1;
  const cardLabel = identicalCardLabel(card, effectiveVal);
  const toast = locMsg('toast.identicalPlay', { name: cp.name, card: cardLabel });
  const celebration = { playerName: cp.name, cardDisplay: cardLabel, consecutive: newConsecutive };

  let ns: ServerGameState = {
    ...st, players: np, discardPile: [...st.discardPile, cardToDiscard],
    hasPlayedCards: true,
    consecutiveIdenticalPlays: newConsecutive,
    lastCardValue: card.type === 'number' ? card.value ?? null : card.type === 'wild' ? effectiveVal : null,
    lastMoveMessage: toast, message: '',
    identicalCelebration: celebration,
  };
  ns = applyCourageRewards(ns, { discardSuccess: true });
  ns = checkWin(ns);
  if (ns.phase === 'game-over') return { ...ns, identicalCelebration: null };
  return endTurnLogic(ns);
}

export function playFraction(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage } {
  if (st.hasPlayedCards) return locErr('fraction.alreadyPlayed');
  const card = findCard(st, cardId);
  if (!card || card.type !== 'fraction') return locErr('fraction.notFound');
  const cp = st.players[st.currentPlayerIndex];
  const denom = fractionDenominator(card.fraction!);

  // ── BLOCK MODE: fraction-on-fraction during defense ──
  if (st.pendingFractionTarget !== null) {
    const newTarget = st.pendingFractionTarget / denom;
    const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
    let ns = applyCourageRewards(
      { ...st, players: np, discardPile: [...st.discardPile, card], hasPlayedCards: true },
      { discardSuccess: true },
    );
    ns = checkWin(ns);
    if (ns.phase === 'game-over') return ns;
    const next = getNextActivePlayerIndex(ns.players, ns.currentPlayerIndex);
    return {
      ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
      currentPlayerIndex: next, phase: 'turn-transition', dice: null,
      stagedCards: [], equationResult: null, validTargets: [],
      consecutiveIdenticalPlays: 0,
      hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
      pendingFractionTarget: newTarget, fractionPenalty: denom,
      fractionAttackResolved: false,
      equationCommits: [],
      lastMoveMessage: locMsg('toast.fractionBlock', { name: cp.name, fraction: String(card.fraction) }),
      message: locMsg('toast.msg.fractionBlocked', { name: cp.name, fraction: String(card.fraction) }),
    };
  }

  // ── ATTACK MODE: fraction on a number card ──
  if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') {
    return locErr('fraction.cannotPlayPhase');
  }
  const td = st.discardPile[st.discardPile.length - 1];
  if (!validateFractionPlay(card, td)) return locErr('fraction.cannotPlayOnTop');
  const effTop = getEffectiveNumber(td);
  if (effTop === null) return locErr('fraction.cannotPlayOnTop');
  const newTarget = effTop / denom;
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  let ns = applyCourageRewards(
    { ...st, players: np, discardPile: [...st.discardPile, card], hasPlayedCards: true },
    { discardSuccess: true },
  );
  ns = checkWin(ns);
  if (ns.phase === 'game-over') return ns;
  const next = getNextActivePlayerIndex(ns.players, ns.currentPlayerIndex);
  return {
    ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    stagedCards: [], equationResult: null, validTargets: [],
    consecutiveIdenticalPlays: 0,
    hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
    pendingFractionTarget: newTarget, fractionPenalty: denom,
    fractionAttackResolved: false,
    equationCommits: [],
    lastMoveMessage: locMsg('toast.fractionAttack', { name: cp.name, fraction: String(card.fraction) }),
    message: locMsg('toast.msg.fractionPlayed', { name: cp.name, fraction: String(card.fraction) }),
  };
}

export function defendFractionSolve(st: ServerGameState, cardId: string, wildResolve?: number): ServerGameState | { error: LocalizedMessage } {
  if (st.pendingFractionTarget === null) return locErr('defend.noActiveAttack');
  const card = findCard(st, cardId);
  const maxWild = st.difficulty === 'easy' ? 12 : 25;
  if (!card) return locErr('stage.cardNotFound');
  if (st.fractionPenalty <= 0) return locErr('defend.cardMismatch');

  let cardToDiscard: Card;
  let lastVal: number;
  if (card.type === 'number') {
    const v = card.value;
    if (v == null || v <= 0 || v % st.fractionPenalty !== 0) return locErr('defend.cardMismatch');
    cardToDiscard = card;
    lastVal = v;
  } else if (card.type === 'wild') {
    const v = wildResolve;
    if (v == null || v <= 0 || v > maxWild || v % st.fractionPenalty !== 0) return locErr('defend.cardMismatch');
    cardToDiscard = { ...card, resolvedValue: v };
    lastVal = v;
  } else {
    return locErr('defend.cardMismatch');
  }

  const cp = st.players[st.currentPlayerIndex];
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  let ns = applyCourageRewards({
    ...st, players: np, discardPile: [...st.discardPile, cardToDiscard],
    pendingFractionTarget: null, fractionPenalty: 0,
    fractionAttackResolved: true, lastCardValue: lastVal,
    lastMoveMessage: locMsg('toast.defenseOk'),
    message: locMsg('msg.defenseOk'),
  }, { discardSuccess: true });
  ns = checkWin(ns);
  if (ns.phase === 'game-over') return ns;
  return endTurnLogic(ns);
}

export function defendFractionPenalty(st: ServerGameState): ServerGameState | { error: LocalizedMessage } {
  if (st.pendingFractionTarget === null) return locErr('defend.noActiveAttack');
  const cp = st.players[st.currentPlayerIndex];
  let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
  s = {
    ...s,
    pendingFractionTarget: null, fractionPenalty: 0,
    fractionAttackResolved: true,
    lastMoveMessage: locMsg('toast.penaltyDraw', { name: cp.name, count: st.fractionPenalty }),
    message: locMsg('msg.penaltyDraw', { name: cp.name, count: st.fractionPenalty }),
  };
  return endTurnLogic(s);
}

export function playOperation(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage } {
  void cardId;
  return locErr('operation.onlyInEquation');
}

export function playJoker(st: ServerGameState, cardId: string, chosenOperation: Operation): ServerGameState | { error: LocalizedMessage } {
  void cardId;
  void chosenOperation;
  return locErr('joker.onlyInEquation');
}

export function drawCard(st: ServerGameState): ServerGameState | { error: LocalizedMessage } {
  if (st.hasPlayedCards || st.hasDrawnCard) return locErr('draw.cannotDrawNow');
  const drawCp = st.players[st.currentPlayerIndex];
  let s = reshuffleDiscard(st);
  if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: '' };
  s = drawFromPile(s, 1, s.currentPlayerIndex);
  s = { ...s, hasDrawnCard: true, lastMoveMessage: locMsg('toast.drawOne', { name: drawCp.name }) };
  return endTurnLogic(s);
}

export function callLulos(st: ServerGameState, playerId: string): ServerGameState | { error: LocalizedMessage } {
  void st;
  void playerId;
  return locErr('call.notAvailable');
}

export function doEndTurn(st: ServerGameState): ServerGameState {
  if (!st.hasPlayedCards && !st.hasDrawnCard) {
    const cp = st.players[st.currentPlayerIndex];
    const penalized = drawFromPile(st, 1, st.currentPlayerIndex);
    const withMsg: ServerGameState = {
      ...penalized,
      lastMoveMessage: locMsg('toast.endTurnNoMove', { name: cp.name }),
      message: '',
    };
    return endTurnLogic(withMsg);
  }
  return endTurnLogic(st);
}

// ══════════════════════════════════════════════════════════════
//  PLAYER VIEW — what each player sees (hides other hands)
// ══════════════════════════════════════════════════════════════

export function getPlayerView(state: ServerGameState, playerId: string, locale: AppLocale): PlayerView {
  const myPlayer = state.players.find(p => p.id === playerId);
  const pileTop = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: playerId,
    opponents: state.players
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        isConnected: p.isConnected,
        isHost: p.isHost,
        isBot: p.isBot,
        calledLolos: p.calledLolos,
        afkWarnings: p.afkWarnings,
        isEliminated: p.isEliminated,
        isSpectator: p.isSpectator,
      })),
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      isConnected: p.isConnected,
      isHost: p.isHost,
      isBot: p.isBot,
      calledLolos: p.calledLolos,
      afkWarnings: p.afkWarnings,
      isEliminated: p.isEliminated,
      isSpectator: p.isSpectator,
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    pileTop,
    deckCount: state.drawPile.length,
    dice: state.dice,
    diceRollSeq: state.diceRollSeq ?? 0,
    validTargets: state.validTargets,
    equationResult: state.equationResult,
    lastEquationDisplay: state.lastEquationDisplay,
    stagedCards: state.stagedCards,
    pendingFractionTarget: state.pendingFractionTarget,
    fractionPenalty: state.fractionPenalty,
    fractionAttackResolved: state.fractionAttackResolved,
    hasPlayedCards: state.hasPlayedCards,
    hasDrawnCard: state.hasDrawnCard,
    lastCardValue: state.lastCardValue,
    consecutiveIdenticalPlays: state.consecutiveIdenticalPlays,
    courageMeterPercent: state.courageMeterPercent,
    courageMeterStep: state.courageMeterStep,
    courageDiscardSuccessStreak: state.courageDiscardSuccessStreak,
    courageRewardPulseId: state.courageRewardPulseId,
    identicalCelebration: state.identicalCelebration ?? null,
    lastMoveMessage: formatLastMove(locale, state.lastMoveMessage),
    difficulty: state.difficulty,
    gameSettings: state.hostGameSettings,
    winner: state.winner ? { id: state.winner.id, name: state.winner.name } : null,
    message: formatGameMessage(locale, state.message),
    openingDrawId: state.openingDrawId,
    turnDeadlineAt: state.turnDeadlineAt,
    roundsPlayed: state.roundsPlayed ?? 0,
    equationCommits: state.equationCommits,
    tournamentTable: state.tournamentTable,
  };
}
