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

// ---------------------------------------------------------------------------
// Group 2: Card-carrying actions — happy path (card found in hand)
// ---------------------------------------------------------------------------

describe('translateBotAction — card-carrying actions (card found)', () => {
  const state = makeState();

  test('3. playIdentical with valid cardId → PLAY_IDENTICAL with resolved Card', () => {
    const result = translateBotAction(state, {
      kind: 'playIdentical',
      cardId: 'c1',
    });
    expect(result).toEqual({ type: 'PLAY_IDENTICAL', card: NUMBER_CARD });
  });

  test('5. playFractionAttack with valid cardId → PLAY_FRACTION with resolved Card', () => {
    const result = translateBotAction(state, {
      kind: 'playFractionAttack',
      cardId: 'c2',
    });
    expect(result).toEqual({ type: 'PLAY_FRACTION', card: FRACTION_CARD });
  });

  test('6. playFractionBlock with valid cardId → PLAY_FRACTION with resolved Card', () => {
    const result = translateBotAction(state, {
      kind: 'playFractionBlock',
      cardId: 'c2',
    });
    expect(result).toEqual({ type: 'PLAY_FRACTION', card: FRACTION_CARD });
  });

  test('7. confirmEquation maps target → result, NOT equationResult', () => {
    const result = translateBotAction(state, {
      kind: 'confirmEquation',
      target: 12,
      equationDisplay: '7 + 5',
      equationOps: ['+'],
      equationCommits: [],
      stagedCardIds: ['c1'],
    });
    expect(result).toEqual({
      type: 'CONFIRM_EQUATION',
      result: 12,
      equationDisplay: '7 + 5',
      equationOps: ['+'],
      equationCommits: [],
    });
    // Explicit check: no `equationResult` field on the output
    expect(result).not.toHaveProperty('equationResult');
  });

  test('8. stageCard with valid cardId → STAGE_CARD with resolved Card', () => {
    const result = translateBotAction(state, {
      kind: 'stageCard',
      cardId: 'c1',
    });
    expect(result).toEqual({ type: 'STAGE_CARD', card: NUMBER_CARD });
  });

  test('9. unstageCard with valid cardId → UNSTAGE_CARD with resolved Card', () => {
    const result = translateBotAction(state, {
      kind: 'unstageCard',
      cardId: 'c1',
    });
    expect(result).toEqual({ type: 'UNSTAGE_CARD', card: NUMBER_CARD });
  });

  test('11. defendFractionSolve with wildResolve → DEFEND_FRACTION_SOLVE with card and wildResolve', () => {
    const result = translateBotAction(state, {
      kind: 'defendFractionSolve',
      cardId: 'c3',
      wildResolve: 4,
    });
    expect(result).toEqual({
      type: 'DEFEND_FRACTION_SOLVE',
      card: WILD_CARD,
      wildResolve: 4,
    });
  });

  test('11b. defendFractionSolve without wildResolve — wildResolve is absent from output', () => {
    const result = translateBotAction(state, {
      kind: 'defendFractionSolve',
      cardId: 'c1',
    });
    expect(result).toEqual({
      type: 'DEFEND_FRACTION_SOLVE',
      card: NUMBER_CARD,
    });
    expect(result).not.toHaveProperty('wildResolve');
  });

  test('12. endTurn → END_TURN', () => {
    const result = translateBotAction(state, { kind: 'endTurn' });
    expect(result).toEqual({ type: 'END_TURN' });
  });

  test('12b. defendFractionPenalty → DEFEND_FRACTION_PENALTY', () => {
    const result = translateBotAction(state, { kind: 'defendFractionPenalty' });
    expect(result).toEqual({ type: 'DEFEND_FRACTION_PENALTY' });
  });
});
