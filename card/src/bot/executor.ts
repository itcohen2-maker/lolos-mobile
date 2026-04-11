// card/src/bot/executor.ts
//
// Translator shim: maps BotAction (bot brain's platform-agnostic vocabulary)
// → GameAction (index.tsx reducer's local vocabulary).
//
// Design spec §0.6. Survey doc section 3 is the authority for exact GameAction
// field names — do NOT infer them from the server engine; the local reducer
// differs. Key differences:
//   • STAGE_CARD, UNSTAGE_CARD, PLAY_IDENTICAL, PLAY_FRACTION, DEFEND_FRACTION_SOLVE
//     all take `card: Card` (full object), NOT a cardId string.
//   • CONFIRM_EQUATION uses field name `result` (NOT `equationResult`).
//   • PLAY_OPERATION does not exist in the local GameAction union.
//
// Recursion guard (design spec §0.5.1, §0.6): if the translated action would be
// { type: 'BOT_STEP' }, the translator returns null. Belt-and-suspenders: no
// BotAction kind currently maps to BOT_STEP, but a future programmer could
// accidentally add one. The guard prevents infinite recursion in gameReducer.

import type { GameAction, GameState, Card } from '../../index';
import type { BotAction } from './types';

// ---------------------------------------------------------------------------
// findCardInHand
// ---------------------------------------------------------------------------

/**
 * Looks up a card by id in the current player's hand.
 * Returns the full Card object if found, undefined otherwise.
 *
 * The translator calls this for every card-carrying BotAction to resolve the
 * bot brain's cardId reference to the actual Card object the local reducer
 * expects. If the card is no longer in the hand (e.g., already played or
 * drawn away), returns undefined and translateBotAction returns null, which
 * triggers the drawCard fallback in applyBotActionAtomically (M5).
 */
export function findCardInHand(
  state: GameState,
  cardId: string,
): Card | undefined {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return undefined;
  return currentPlayer.hand.find((c) => c.id === cardId);
}

// ---------------------------------------------------------------------------
// translateBotAction
// ---------------------------------------------------------------------------

/**
 * Maps a BotAction to the equivalent local GameAction.
 *
 * Returns null when:
 * - The BotAction references a cardId that is no longer in the bot's hand.
 * - The translated action would be { type: 'BOT_STEP' } (recursion guard).
 * - The BotAction kind is unrecognised.
 *
 * IMPORTANT: this function only translates. It does NOT dispatch. The caller
 * (applyBotActionAtomically in M5) is responsible for dispatching into
 * gameReducer and for sequencing the confirmEquation → stageCard × N →
 * confirmStaged burst. The translator never stages cards on behalf of a
 * confirmEquation action; that sequencing belongs to the executor layer.
 */
export function translateBotAction(
  state: GameState,
  action: BotAction,
): GameAction | null {
  const translated = translateInner(state, action);

  // Recursion guard: belt-and-suspenders protection against a future BotAction
  // kind accidentally mapping back to BOT_STEP and causing infinite recursion
  // in the gameReducer BOT_STEP case. Design spec §0.6.
  if (translated && (translated as { type: string }).type === 'BOT_STEP') {
    return null;
  }

  return translated;
}

// ---------------------------------------------------------------------------
// translateInner — the actual switch; not exported
// ---------------------------------------------------------------------------

function translateInner(
  state: GameState,
  action: BotAction,
): GameAction | null {
  switch (action.kind) {
    // -----------------------------------------------------------------------
    // No-card actions — straightforward 1:1 mapping
    // -----------------------------------------------------------------------

    case 'beginTurn':
      return { type: 'BEGIN_TURN' };

    case 'rollDice':
      // No values field: let the reducer generate random dice values.
      return { type: 'ROLL_DICE' };

    case 'drawCard':
      return { type: 'DRAW_CARD' };

    case 'confirmStaged':
      return { type: 'CONFIRM_STAGED' };

    case 'endTurn':
      return { type: 'END_TURN' };

    case 'defendFractionPenalty':
      return { type: 'DEFEND_FRACTION_PENALTY' };

    // -----------------------------------------------------------------------
    // confirmEquation — field name is `result`, NOT `equationResult`.
    // Survey doc section 3, line 201 (CONFIRM_EQUATION exact shape):
    //   { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string;
    //     equationOps: Operation[]; equationCommits?: {...}[] }
    //
    // The BotAction carries `target` (the number the bot is solving for) which
    // maps to the `result` field. `equationOps` is required — the bot brain
    // populates it from the operators used in the plan.
    //
    // NOTE: translateBotAction does NOT stage cards here. The confirmEquation
    // BotAction carries `stagedCardIds` so applyBotActionAtomically (M5) can
    // stage them in a subsequent loop — but that sequencing is the executor's
    // responsibility, not the translator's.
    // -----------------------------------------------------------------------

    case 'confirmEquation':
      return {
        type: 'CONFIRM_EQUATION',
        result: action.target,
        equationDisplay: action.equationDisplay,
        equationOps: action.equationOps,
        equationCommits: action.equationCommits,
      };

    // -----------------------------------------------------------------------
    // Card-carrying actions — must resolve cardId → Card via findCardInHand.
    // If the card is not in the current player's hand, return null to trigger
    // the drawCard fallback. Survey doc section 3 confirms all of these take
    // `card: Card` (full object), not a cardId string.
    // -----------------------------------------------------------------------

    case 'playIdentical': {
      const card = findCardInHand(state, action.cardId);
      if (!card) return null;
      return { type: 'PLAY_IDENTICAL', card };
    }

    case 'playFractionAttack': {
      // Both attack and block map to PLAY_FRACTION — the reducer distinguishes
      // attack vs block by whether pendingFractionTarget is already set on the
      // target player. The bot brain uses separate kinds for clarity; the
      // local reducer sees only PLAY_FRACTION.
      const card = findCardInHand(state, action.cardId);
      if (!card) return null;
      return { type: 'PLAY_FRACTION', card };
    }

    case 'playFractionBlock': {
      const card = findCardInHand(state, action.cardId);
      if (!card) return null;
      return { type: 'PLAY_FRACTION', card };
    }

    case 'stageCard': {
      const card = findCardInHand(state, action.cardId);
      if (!card) return null;
      return { type: 'STAGE_CARD', card };
    }

    case 'unstageCard': {
      // unstageCard looks in the hand — at the time of unstaging, the card
      // should still be considered "in hand" from the bot's planning
      // perspective. If findCardInHand returns undefined it means the card
      // was never in hand, which is a planner error; return null to fall back.
      const card = findCardInHand(state, action.cardId);
      if (!card) return null;
      return { type: 'UNSTAGE_CARD', card };
    }

    case 'defendFractionSolve': {
      const card = findCardInHand(state, action.cardId);
      if (!card) return null;
      return {
        type: 'DEFEND_FRACTION_SOLVE',
        card,
        // wildResolve is optional on both BotAction and GameAction.
        // Pass through as-is; if undefined it is simply omitted.
        ...(action.wildResolve !== undefined
          ? { wildResolve: action.wildResolve }
          : {}),
      };
    }

    // -----------------------------------------------------------------------
    // Default — unrecognised BotAction kind.
    // TypeScript's exhaustive switch would normally catch this at compile time,
    // but a runtime guard is prudent for future action kinds added before the
    // translator is updated.
    // -----------------------------------------------------------------------

    default: {
      // Exhaustive check: if TypeScript narrows `action` to `never` here, the
      // switch is exhaustive and this branch is unreachable at runtime.
      const _exhaustive: never = action;
      void _exhaustive;
      return null;
    }
  }
}
