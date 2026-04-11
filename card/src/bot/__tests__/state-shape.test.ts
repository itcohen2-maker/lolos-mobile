// Tests that GameState has botConfig and botTickSeq fields, and that
// initialState defaults them correctly.

import { initialState, gameReducer } from '../../../index';
import type { GameState, GameAction } from '../../../index';

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

describe('Player isBot field', () => {
  it('default player from initialState has no bot entries (players array is empty)', () => {
    expect(initialState.players).toEqual([]);
  });

  it('START_GAME with isBot:true player produces a player with isBot:true', () => {
    const action = {
      type: 'START_GAME' as const,
      players: [
        { name: 'Alice', isBot: false },
        { name: 'Bot', isBot: true },
      ],
      difficulty: 'full' as const,
      fractions: true,
      showPossibleResults: true,
      showSolveExercise: true,
      timerSetting: 'off' as const,
    };
    const mockTf = (key: string): string => key;
    const next = gameReducer(initialState, action as GameAction, mockTf);
    expect(next.players).toHaveLength(2);
    expect(next.players[0].isBot).toBe(false);
    expect(next.players[1].isBot).toBe(true);
    expect(next.players[0].name).toBe('Alice');
    expect(next.players[1].name).toBe('Bot');
  });

  it('START_GAME with players missing isBot defaults to false', () => {
    const action = {
      type: 'START_GAME' as const,
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      difficulty: 'full' as const,
      fractions: true,
      showPossibleResults: true,
      showSolveExercise: true,
      timerSetting: 'off' as const,
    };
    const mockTf = (key: string): string => key;
    const next = gameReducer(initialState, action as GameAction, mockTf);
    expect(next.players[0].isBot).toBe(false);
    expect(next.players[1].isBot).toBe(false);
  });
});
