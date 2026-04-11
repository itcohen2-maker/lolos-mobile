// Tests that GameState has botConfig and botTickSeq fields, and that
// initialState defaults them correctly.

import { initialState } from '../../../index';
import type { GameState } from '../../../index';

describe('GameState bot fields', () => {
  it('initialState.botConfig is null', () => {
    expect(initialState.botConfig).toBeNull();
  });

  it('initialState.botTickSeq is 0', () => {
    expect(initialState.botTickSeq).toBe(0);
  });

  it('botConfig field type accepts { difficulty, playerIds } shape', () => {
    // Compile-time type check via variable assignment
    const config: GameState['botConfig'] = {
      difficulty: 'easy',
      playerIds: [1, 2] as const,
    };
    expect(config).not.toBeNull();
  });

  it('botConfig field type accepts null', () => {
    const config: GameState['botConfig'] = null;
    expect(config).toBeNull();
  });
});
