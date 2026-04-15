/**
 * בדיקות: אכיפת enabledOperators על קלפי פעולה מהיד, ומונה diceRollSeq אחרי הטלה.
 */
import { gameReducer, initialState } from '../../index';
import type { GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function buildingState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState,
    phase: 'building',
    dice: { die1: 1, die2: 2, die3: 3 },
    diceRollSeq: 1,
    enabledOperators: ['+', '-'],
    players: [
      {
        id: 'p0',
        name: 'T',
        hand: [],
        calledLolos: false,
        isConnected: true,
        isHost: true,
        isBot: false,
        afkWarnings: 0,
        isEliminated: false,
        isSpectator: false,
        locale: 'he',
      },
    ],
    equationHandSlots: [null, null],
    equationHandPick: null,
    message: '',
    ...overrides,
  };
}

describe('equation hand / dice seq reducer', () => {
  it('SELECT_EQ_OP rejects × when stage only allows + −', () => {
    const st = buildingState();
    const mulCard = { id: 'op-mul', type: 'operation' as const, operation: 'x' as const };
    const next = gameReducer(st, { type: 'SELECT_EQ_OP', card: mulCard } as GameAction, tf);
    expect(next.message).toBe('equation.operatorNotInStage');
    expect(next.equationHandPick).toBeNull();
    expect(next.equationHandSlots).toEqual(st.equationHandSlots);
  });

  it('SELECT_EQ_JOKER rejects disallowed chosen operation', () => {
    const st = buildingState();
    const joker = { id: 'jk1', type: 'joker' as const };
    const next = gameReducer(
      st,
      { type: 'SELECT_EQ_JOKER', card: joker, chosenOperation: 'x' } as GameAction,
      tf,
    );
    expect(next.message).toBe('equation.operatorNotInStage');
    expect(next.equationHandPick).toBeNull();
  });

  it('PLACE_EQ_OP rejects pick with disallowed effective op', () => {
    const mulCard = { id: 'op-mul', type: 'operation' as const, operation: 'x' as const };
    const st = buildingState({
      equationHandPick: { card: mulCard, jokerAs: null },
    });
    const next = gameReducer(st, { type: 'PLACE_EQ_OP', position: 0 } as GameAction, tf);
    expect(next.equationHandSlots).toEqual([null, null]);
    expect(next.equationHandPick).toBeNull();
    expect(next.message).toBe('equation.operatorNotInStage');
  });

  it('ROLL_DICE increments diceRollSeq', () => {
    const st: GameState = {
      ...initialState,
      phase: 'pre-roll',
      diceRollSeq: 3,
      enabledOperators: ['+', '-'],
      mathRangeMax: 25,
      allowNegativeTargets: false,
      players: buildingState().players,
    };
    const dice = { die1: 2, die2: 2, die3: 2 };
    const next = gameReducer(st, { type: 'ROLL_DICE', values: dice } as GameAction, tf);
    expect(next.diceRollSeq).toBe(4);
    expect(next.dice).toEqual(dice);
    expect(next.phase).toBe('building');
  });
});
