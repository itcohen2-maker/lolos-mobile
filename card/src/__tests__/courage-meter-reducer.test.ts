import { gameReducer, initialState } from '../../index';
import type { GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function basePlayer(hand: GameState['players'][number]['hand']): GameState['players'][number] {
  return { id: 0, name: 'P1', hand, calledLolos: false, isBot: false };
}

function preRollIdenticalState(overrides: Partial<GameState> = {}): GameState {
  const matchingCard = { id: 'n7', type: 'number' as const, value: 7 };
  return {
    ...initialState,
    phase: 'pre-roll',
    players: [basePlayer([matchingCard])],
    currentPlayerIndex: 0,
    discardPile: [{ id: 'top7', type: 'number', value: 7 }],
    ...overrides,
  };
}

function solvedConfirmState(overrides: Partial<GameState> = {}): GameState {
  const staged = { id: 'n5', type: 'number' as const, value: 5 };
  return {
    ...initialState,
    phase: 'solved',
    players: [basePlayer([staged, { id: 'extra', type: 'number', value: 9 }])],
    currentPlayerIndex: 0,
    discardPile: [{ id: 'top3', type: 'number', value: 3 }],
    stagedCards: [staged],
    equationResult: 5,
    lastEquationDisplay: '2+3',
    equationHandSlots: [null, null],
    ...overrides,
  };
}

describe('courage meter reducer rules', () => {
  it('does not progress on PLAY_IDENTICAL', () => {
    const st = preRollIdenticalState({ courageMeterStep: 1, courageMeterPercent: 33, courageCoins: 0 });
    const next = gameReducer(st, { type: 'PLAY_IDENTICAL', card: st.players[0].hand[0] } as GameAction, tf);
    expect(next.courageMeterStep).toBe(1);
    expect(next.courageMeterPercent).toBe(33);
    expect(next.courageCoins).toBe(0);
  });

  it('advances only on successful CONFIRM_STAGED', () => {
    const s1 = solvedConfirmState({ courageMeterStep: 0, courageMeterPercent: 0, courageCoins: 0 });
    const n1 = gameReducer(s1, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(n1.courageMeterStep).toBe(1);
    expect(n1.courageMeterPercent).toBe(33);
    expect(n1.courageCoins).toBe(0);

    const s2 = solvedConfirmState({ courageMeterStep: 1, courageMeterPercent: 33, courageCoins: 0 });
    const n2 = gameReducer(s2, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(n2.courageMeterStep).toBe(2);
    expect(n2.courageMeterPercent).toBe(66);
  });

  it('auto-resets at full and grants 5 coins', () => {
    const st = solvedConfirmState({
      courageMeterStep: 2,
      courageMeterPercent: 66,
      courageCoins: 7,
      courageRewardPulseId: 4,
    });
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(next.courageMeterStep).toBe(0);
    expect(next.courageMeterPercent).toBe(0);
    expect(next.courageCoins).toBe(12);
    expect(next.courageDiscardSuccessStreak).toBe(0);
    expect(next.courageRewardPulseId).toBe(5);
  });
});
