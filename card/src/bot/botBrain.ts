// Client-side bot brain.
// Pure function: decideBotAction(state, difficulty, opts?) → BotAction | null.
// Port of server/src/socketHandlers.ts lines 313-458 retargeted to the
// local reducer's types and helpers.
//
// See spec §0.5.1, §0.6, server bot reference sections 1-5.

import type {
  GameState,
  Card,
  Operation,
  EquationCommitPayload,
} from '../../index';
import {
  validateFractionPlay,
  validateIdenticalPlay,
  validateStagedCards,
  fractionDenominator,
} from '../../index';
import type { BotAction, BotDifficulty } from './types';
import { pickBotStagedPlan } from '../../shared/botPlan';

export type DecideBotActionOptions = {
  /** Defaults to Math.random; tests may inject a sequence. */
  rng?: () => number;
};

function resolveBotRng(state: GameState, opts?: DecideBotActionOptions): () => number {
  if (opts?.rng) return opts.rng;
  const bc = state.botConfig;
  if (bc && typeof (bc as { rng?: () => number }).rng === 'function') {
    return (bc as { rng: () => number }).rng;
  }
  return Math.random;
}

/**
 * Pick at most one operation/joker card to commit to the equation.
 * Position 0 only. Joker uses the first enabled operator as its chosen op.
 */
function buildBotCommits(state: GameState): EquationCommitPayload[] {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const operationCard = hand.find((card) => card.type === 'operation');
  if (operationCard) {
    return [{ cardId: operationCard.id, position: 0, jokerAs: null }];
  }
  const jokerCard = hand.find((card) => card.type === 'joker');
  if (jokerCard) {
    const fallback: Operation = state.enabledOperators?.[0] ?? '+';
    return [{ cardId: jokerCard.id, position: 0, jokerAs: fallback }];
  }
  return [];
}

/**
 * Derive the equationOps list from a commit list by looking up each committed
 * card in the hand. Operation cards contribute their .operation; jokers
 * contribute their jokerAs field.
 */
function deriveEquationOps(
  commits: EquationCommitPayload[],
  hand: Card[],
): Operation[] {
  const ops: Operation[] = [];
  for (const commit of commits) {
    const card = hand.find((c) => c.id === commit.cardId);
    if (!card) continue;
    if (card.type === 'joker' && commit.jokerAs) {
      ops.push(commit.jokerAs);
    } else if (card.type === 'operation' && card.operation) {
      ops.push(card.operation);
    }
  }
  return ops;
}

/**
 * Brute-force subset enumerator + difficulty pick (shared with server).
 */
function buildBotStagedPlan(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): {
  target: number;
  equationDisplay: string;
  stagedCardIds: string[];
  equationCommits: EquationCommitPayload[];
} | null {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const equationCommits = buildBotCommits(state);
  const commitIds = new Set(equationCommits.map((c) => c.cardId));
  const candidates = hand.filter(
    (card) =>
      (card.type === 'number' || card.type === 'wild' || card.type === 'operation') &&
      !commitIds.has(card.id),
  );
  const maxWild = state.mathRangeMax ?? 25;
  return pickBotStagedPlan(
    state.validTargets,
    candidates,
    equationCommits,
    maxWild,
    validateStagedCards,
    difficulty,
    { rng },
  );
}

/**
 * Defense priority: divisible number → wild (wildResolve=fractionPenalty)
 *                   → counter fraction → penalty.
 */
function handleBotDefense(state: GameState): BotAction {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const penalty = state.fractionPenalty;

  const divisibleCard = hand.find(
    (card) =>
      card.type === 'number' &&
      (card.value ?? 0) > 0 &&
      (card.value ?? 0) % penalty === 0,
  );
  if (divisibleCard) {
    return { kind: 'defendFractionSolve', cardId: divisibleCard.id };
  }

  const wildCard = hand.find((card) => card.type === 'wild');
  if (wildCard) {
    return {
      kind: 'defendFractionSolve',
      cardId: wildCard.id,
      wildResolve: Math.max(penalty, 1),
    };
  }

  const counterFraction = hand.find((card) => card.type === 'fraction');
  if (counterFraction) {
    return { kind: 'playFractionBlock', cardId: counterFraction.id };
  }

  return { kind: 'defendFractionPenalty' };
}

/**
 * Pre-roll priority: identical-playable → attack fraction → rollDice.
 */
function handleBotPreRoll(state: GameState): BotAction {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const identicalCard = hand.find((card) =>
    validateIdenticalPlay(card, topDiscard),
  );
  if (identicalCard) {
    return { kind: 'playIdentical', cardId: identicalCard.id };
  }

  const attackFraction = hand.find(
    (card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard),
  );
  if (attackFraction) {
    return { kind: 'playFractionAttack', cardId: attackFraction.id };
  }

  return { kind: 'rollDice' };
}

/**
 * Building: compute plan once (captured at decision time). If plan, return
 * confirmEquation with stagedCardIds; else drawCard.
 */
function handleBotBuilding(
  state: GameState,
  difficulty: BotDifficulty,
  rng: () => number,
): BotAction {
  const plan = buildBotStagedPlan(state, difficulty, rng);
  if (!plan) {
    return { kind: 'drawCard' };
  }
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const equationOps = deriveEquationOps(plan.equationCommits, hand);
  return {
    kind: 'confirmEquation',
    target: plan.target,
    equationDisplay: plan.equationDisplay,
    equationCommits: plan.equationCommits,
    equationOps,
    stagedCardIds: plan.stagedCardIds,
  };
}

/**
 * Main entry point. Switch on state.phase.
 */
export function decideBotAction(
  state: GameState,
  difficulty: BotDifficulty,
  opts?: DecideBotActionOptions,
): BotAction | null {
  const rng = resolveBotRng(state, opts);
  switch (state.phase) {
    case 'setup':
      return null;
    case 'turn-transition':
      return { kind: 'beginTurn' };
    case 'pre-roll':
    case 'roll-dice':
      if (state.pendingFractionTarget !== null) {
        return handleBotDefense(state);
      }
      return handleBotPreRoll(state);
    case 'building':
      return handleBotBuilding(state, difficulty, rng);
    case 'solved':
      return { kind: 'drawCard' };
    case 'game-over':
      return null;
    default:
      return null;
  }
}

// Silence unused-import warning for fractionDenominator. It's imported for
// future use in fraction-value computations but the current brain logic only
// relies on fractionPenalty from state, not computed denominators.
void fractionDenominator;
