// card/src/bot/__tests__/executor.test.ts

import { translateBotAction, findCardInHand } from '../executor';
import type { GameState } from '../../../index';

const NUMBER_CARD = { id: 'c1', type: 'number' as const, value: 7 };
const FRACTION_CARD = { id: 'c2', type: 'fraction' as const, fraction: '1/2' as const };
const WILD_CARD = { id: 'c3', type: 'wild' as const };

function makeState(hand = [NUMBER_CARD, FRACTION_CARD, WILD_CARD]): GameState {
  return {
    currentPlayerIndex: 0,
    players: [
      { id: 0, name: 'Bot', hand, calledLolos: false, isBot: true },
    ],
  } as unknown as GameState;
}

// ---------------------------------------------------------------------------
// Group 1: Basic no-card actions
// ---------------------------------------------------------------------------

describe('translateBotAction — no-card actions', () => {
  const state = makeState();

  test('1. beginTurn → BEGIN_TURN', () => {
    expect(translateBotAction(state, { kind: 'beginTurn' })).toEqual({
      type: 'BEGIN_TURN',
    });
  });

  test('2. rollDice → ROLL_DICE (no values field)', () => {
    expect(translateBotAction(state, { kind: 'rollDice' })).toEqual({
      type: 'ROLL_DICE',
    });
  });

  test('10. drawCard → DRAW_CARD', () => {
    expect(translateBotAction(state, { kind: 'drawCard' })).toEqual({
      type: 'DRAW_CARD',
    });
  });

  test('10b. confirmStaged → CONFIRM_STAGED', () => {
    expect(translateBotAction(state, { kind: 'confirmStaged' })).toEqual({
      type: 'CONFIRM_STAGED',
    });
  });
});
