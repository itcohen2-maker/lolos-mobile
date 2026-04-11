// Types for the client-side bot brain.
// See docs/superpowers/specs/2026-04-11-single-player-vs-bot-design.md §0.5.1 and §0.6.

import type { Operation, EquationCommitPayload } from '../../index';

export type BotDifficulty = 'easy' | 'hard';

/**
 * Discriminated union of every action the bot brain can decide to take.
 * The translator (src/bot/executor.ts) maps each kind to a local reducer
 * GameAction. The brain works with string cardIds; the translator resolves
 * them to Card objects from state.players[currentPlayerIndex].hand.
 */
export type BotAction =
  | { kind: 'beginTurn' }
  | { kind: 'rollDice' }
  | { kind: 'playIdentical'; cardId: string }
  | { kind: 'playFractionAttack'; cardId: string }
  | { kind: 'playFractionBlock'; cardId: string }
  | {
      kind: 'confirmEquation';
      target: number;
      equationDisplay: string;
      equationCommits: EquationCommitPayload[];
      equationOps: Operation[];
      /** Cards to stage after confirmEquation, captured at decision time to avoid mid-stage plan drift. */
      stagedCardIds: ReadonlyArray<string>;
    }
  | { kind: 'stageCard'; cardId: string }
  | { kind: 'unstageCard'; cardId: string }
  | { kind: 'confirmStaged' }
  | { kind: 'drawCard' }
  | { kind: 'endTurn' }
  | { kind: 'defendFractionSolve'; cardId: string; wildResolve?: number }
  | { kind: 'defendFractionPenalty' };
