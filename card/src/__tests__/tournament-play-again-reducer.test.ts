import { gameReducer, initialState } from '../../index';
import type { GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function buildFinishedState(): GameState {
  return {
    ...initialState,
    phase: 'game-over',
    difficulty: 'full',
    difficultyStage: 'H',
    showFractions: true,
    fractionKinds: ['1/2', '1/3', '1/4', '1/5'],
    showPossibleResults: true,
    showSolveExercise: true,
    timerSetting: 'off',
    timerCustomSeconds: 60,
    mathRangeMax: 25,
    enabledOperators: ['x', '÷'],
    allowNegativeTargets: true,
    abVariant: 'variant_0_15_plus',
    players: [
      { id: 0, name: 'Dana', hand: [{ id: 'n1', type: 'number', value: 1 }], calledLolos: false, isBot: false },
      { id: 1, name: 'Roi', hand: [{ id: 'n2', type: 'number', value: 2 }], calledLolos: false, isBot: false },
    ],
    tournamentTable: [
      { playerId: 0, playerName: 'Dana', wins: 2, losses: 1 },
      { playerId: 1, playerName: 'Roi', wins: 1, losses: 2 },
    ],
  };
}

describe('PLAY_AGAIN tournament behavior', () => {
  it('keeps accumulated tournament results when starting another game', () => {
    const ended = buildFinishedState();
    const next = gameReducer(ended, { type: 'PLAY_AGAIN' } as GameAction, tf);

    expect(next.phase).toBe('turn-transition');
    expect(next.tournamentTable).toEqual([
      { playerId: 0, playerName: 'Dana', wins: 2, losses: 1 },
      { playerId: 1, playerName: 'Roi', wins: 1, losses: 2 },
    ]);
  });
});
