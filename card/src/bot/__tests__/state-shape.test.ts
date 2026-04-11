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

describe('START_GAME with mode and botDifficulty', () => {
  const baseAction = {
    difficulty: 'full' as const,
    fractions: true,
    showPossibleResults: true,
    showSolveExercise: true,
    timerSetting: 'off' as const,
  };

  it('START_GAME with mode=pass-and-play sets botConfig to null', () => {
    const action = {
      type: 'START_GAME' as const,
      mode: 'pass-and-play' as const,
      players: [{ name: 'Alice', isBot: false }, { name: 'Bob', isBot: false }],
      ...baseAction,
    };
    const mockTf = (key: string): string => key;
    const next = gameReducer(initialState, action as GameAction, mockTf);
    expect(next.botConfig).toBeNull();
    expect(next.botTickSeq).toBe(0);
  });

  it('START_GAME with mode=vs-bot and one bot player derives botConfig', () => {
    const action = {
      type: 'START_GAME' as const,
      mode: 'vs-bot' as const,
      botDifficulty: 'hard' as const,
      players: [
        { name: 'Alice', isBot: false },
        { name: 'Bot', isBot: true },
      ],
      ...baseAction,
    };
    const mockTf = (key: string): string => key;
    const next = gameReducer(initialState, action as GameAction, mockTf);
    expect(next.botConfig).not.toBeNull();
    expect(next.botConfig?.difficulty).toBe('hard');
    expect(next.botConfig?.playerIds).toEqual([1]);
    expect(next.botTickSeq).toBe(0);
  });

  it('START_GAME with mode=vs-bot defaults botDifficulty to easy when omitted', () => {
    const action = {
      type: 'START_GAME' as const,
      mode: 'vs-bot' as const,
      players: [
        { name: 'Alice', isBot: false },
        { name: 'Bot', isBot: true },
      ],
      ...baseAction,
    };
    const mockTf = (key: string): string => key;
    const next = gameReducer(initialState, action as GameAction, mockTf);
    expect(next.botConfig?.difficulty).toBe('easy');
  });

  it('PLAY_AGAIN preserves botConfig from previous state', () => {
    // First start a vs-bot game
    const startAction = {
      type: 'START_GAME' as const,
      mode: 'vs-bot' as const,
      botDifficulty: 'hard' as const,
      players: [
        { name: 'Alice', isBot: false },
        { name: 'Bot', isBot: true },
      ],
      ...baseAction,
    };
    const mockTf = (key: string): string => key;
    const afterStart = gameReducer(initialState, startAction as GameAction, mockTf);
    expect(afterStart.botConfig?.difficulty).toBe('hard');

    // Now PLAY_AGAIN
    const afterRematch = gameReducer(afterStart, { type: 'PLAY_AGAIN' }, mockTf);
    expect(afterRematch.botConfig).not.toBeNull();
    expect(afterRematch.botConfig?.difficulty).toBe('hard');
    expect(afterRematch.botConfig?.playerIds).toEqual([1]);
    expect(afterRematch.botTickSeq).toBe(0); // botTickSeq resets on rematch
  });
});
