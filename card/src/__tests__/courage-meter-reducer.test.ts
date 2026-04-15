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
  it('advances step milestones to 33, 66, 100 on streak rewards', () => {
    const s1 = preRollIdenticalState({ courageMeterStep: 0, courageMeterPercent: 0, courageDiscardSuccessStreak: 1 });
    const n1 = gameReducer(s1, { type: 'PLAY_IDENTICAL', card: s1.players[0].hand[0] } as GameAction, tf);
    expect(n1.courageMeterStep).toBe(1);
    expect(n1.courageMeterPercent).toBe(33);

    const s2 = preRollIdenticalState({ courageMeterStep: 1, courageMeterPercent: 33, courageDiscardSuccessStreak: 1 });
    const n2 = gameReducer(s2, { type: 'PLAY_IDENTICAL', card: s2.players[0].hand[0] } as GameAction, tf);
    expect(n2.courageMeterStep).toBe(2);
    expect(n2.courageMeterPercent).toBe(66);

    const s3 = preRollIdenticalState({ courageMeterStep: 2, courageMeterPercent: 66, courageDiscardSuccessStreak: 1 });
    const n3 = gameReducer(s3, { type: 'PLAY_IDENTICAL', card: s3.players[0].hand[0] } as GameAction, tf);
    expect(n3.courageMeterStep).toBe(3);
    expect(n3.courageMeterPercent).toBe(100);
  });

  it('caps courage meter at full and does not exceed 100', () => {
    const st = preRollIdenticalState({
      courageMeterStep: 3,
      courageMeterPercent: 100,
      courageDiscardSuccessStreak: 1,
      courageRewardPulseId: 9,
    });
    const next = gameReducer(st, { type: 'PLAY_IDENTICAL', card: st.players[0].hand[0] } as GameAction, tf);
    expect(next.courageMeterStep).toBe(3);
    expect(next.courageMeterPercent).toBe(100);
    expect(next.courageRewardPulseId).toBe(9);
    expect(next.courageDiscardSuccessStreak).toBe(0);
  });

  it('grants combined equation + streak reward and resets streak', () => {
    const st = solvedConfirmState({
      courageMeterStep: 0,
      courageMeterPercent: 0,
      courageDiscardSuccessStreak: 1,
    });
    const next = gameReducer(st, { type: 'CONFIRM_STAGED' } as GameAction, tf);
    expect(next.courageMeterStep).toBe(2);
    expect(next.courageMeterPercent).toBe(66);
    expect(next.courageDiscardSuccessStreak).toBe(0);
    expect(next.courageRewardPulseId).toBe(2);
  });
});
