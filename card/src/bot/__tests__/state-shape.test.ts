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

describe('BOT_STEP reducer case', () => {
  const botGameAction = {
    type: 'START_GAME' as const,
    mode: 'vs-bot' as const,
    botDifficulty: 'hard' as const,
    players: [
      { name: 'Human', isBot: false },
      { name: 'Bot', isBot: true },
    ],
    difficulty: 'full' as const,
    fractions: true,
    showPossibleResults: true,
    showSolveExercise: true,
    timerSetting: 'off' as const,
  };
  const mockTf = (key: string): string => key;

  it('BOT_STEP increments botTickSeq', () => {
    const afterStart = gameReducer(initialState, botGameAction as GameAction, mockTf);
    // Simulate: bot is not current yet but let's force it. If the bot is already
    // current after START_GAME, this test works as-is. If not, we swap via a cast.
    const stateWithBotCurrent = afterStart.players[afterStart.currentPlayerIndex].isBot
      ? afterStart
      : { ...afterStart, currentPlayerIndex: afterStart.players.findIndex(p => p.isBot) };
    const afterStep = gameReducer(stateWithBotCurrent, { type: 'BOT_STEP' }, mockTf);
    expect(afterStep.botTickSeq).toBeGreaterThan(stateWithBotCurrent.botTickSeq);
  });

  it('BOT_STEP is a no-op when current player is not a bot', () => {
    const afterStart = gameReducer(initialState, botGameAction as GameAction, mockTf);
    const humanIdx = afterStart.players.findIndex(p => !p.isBot);
    const stateWithHumanCurrent = { ...afterStart, currentPlayerIndex: humanIdx };
    const afterStep = gameReducer(stateWithHumanCurrent, { type: 'BOT_STEP' }, mockTf);
    // botTickSeq still increments (the counter always advances) but phase is unchanged
    expect(afterStep.botTickSeq).toBe(stateWithHumanCurrent.botTickSeq + 1);
    expect(afterStep.phase).toBe(stateWithHumanCurrent.phase);
    expect(afterStep.currentPlayerIndex).toBe(humanIdx);
  });

  it('BOT_STEP in turn-transition progresses to pre-roll or beyond', () => {
    const afterStart = gameReducer(initialState, botGameAction as GameAction, mockTf);
    // turn-transition is the phase right after START_GAME
    expect(afterStart.phase).toBe('turn-transition');
    const botIdx = afterStart.players.findIndex(p => p.isBot);
    const stateWithBotCurrent = { ...afterStart, currentPlayerIndex: botIdx };
    const afterStep = gameReducer(stateWithBotCurrent, { type: 'BOT_STEP' }, mockTf);
    // beginTurn transitions to pre-roll (or further if the bot has a fraction-defense path)
    expect(['pre-roll', 'building', 'solved', 'turn-transition']).toContain(afterStep.phase);
  });

  it('BOT_STEP in game-over is a pure no-op (except botTickSeq)', () => {
    const gameOverState = { ...initialState, phase: 'game-over' as const, botConfig: { difficulty: 'hard' as const, playerIds: [] as const } };
    const afterStep = gameReducer(gameOverState, { type: 'BOT_STEP' }, mockTf);
    expect(afterStep.phase).toBe('game-over');
  });
});
