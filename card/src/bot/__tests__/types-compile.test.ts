// Compile-time check that BotDifficulty and BotAction types are exported
// from ../types and have the expected shape. At runtime this is just
// a trivial assertion — the value comes from TypeScript catching errors
// at compile time.

import type { BotDifficulty, BotAction } from '../types';
import type { Operation } from '../../../index';

describe('src/bot/types exports', () => {
  it('BotDifficulty accepts easy and hard', () => {
    const easy: BotDifficulty = 'easy';
    const hard: BotDifficulty = 'hard';
    expect(easy).toBe('easy');
    expect(hard).toBe('hard');
  });

  it('BotAction union includes all 13 kinds', () => {
    const actions: BotAction[] = [
      { kind: 'beginTurn' },
      { kind: 'rollDice' },
      { kind: 'playIdentical', cardId: 'c1' },
      { kind: 'playFractionAttack', cardId: 'c2' },
      { kind: 'playFractionBlock', cardId: 'c3' },
      {
        kind: 'confirmEquation',
        target: 7,
        equationDisplay: '3+4',
        equationCommits: [],
        equationOps: ['+' as Operation],
        stagedCardIds: ['c4', 'c5'],
      },
      { kind: 'stageCard', cardId: 'c6' },
      { kind: 'unstageCard', cardId: 'c7' },
      { kind: 'confirmStaged' },
      { kind: 'drawCard' },
      { kind: 'endTurn' },
      { kind: 'defendFractionSolve', cardId: 'c8', wildResolve: 2 },
      { kind: 'defendFractionPenalty' },
    ];
    expect(actions).toHaveLength(13);
  });
});
