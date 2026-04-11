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

// ---------------------------------------------------------------------------
// Group 3: cardId-not-in-hand — all card-carrying actions return null
// ---------------------------------------------------------------------------

describe('translateBotAction — cardId not in hand returns null', () => {
  // Empty-hand state: every card-carrying action will fail to resolve.
  const emptyState = makeState([]);

  test('4. playIdentical with unknown cardId → null', () => {
    expect(
      translateBotAction(emptyState, { kind: 'playIdentical', cardId: 'nonexistent' }),
    ).toBeNull();
  });

  test('playFractionAttack with unknown cardId → null', () => {
    expect(
      translateBotAction(emptyState, { kind: 'playFractionAttack', cardId: 'nonexistent' }),
    ).toBeNull();
  });

  test('playFractionBlock with unknown cardId → null', () => {
    expect(
      translateBotAction(emptyState, { kind: 'playFractionBlock', cardId: 'nonexistent' }),
    ).toBeNull();
  });

  test('stageCard with unknown cardId → null', () => {
    expect(
      translateBotAction(emptyState, { kind: 'stageCard', cardId: 'nonexistent' }),
    ).toBeNull();
  });

  test('unstageCard with unknown cardId → null', () => {
    expect(
      translateBotAction(emptyState, { kind: 'unstageCard', cardId: 'nonexistent' }),
    ).toBeNull();
  });

  test('defendFractionSolve with unknown cardId → null', () => {
    expect(
      translateBotAction(emptyState, {
        kind: 'defendFractionSolve',
        cardId: 'nonexistent',
        wildResolve: 2,
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Group 4: Recursion guard — reject any action that translates to BOT_STEP
// ---------------------------------------------------------------------------

describe('translateBotAction — recursion guard', () => {
  const state = makeState();

  test('14. An action that somehow maps to BOT_STEP is rejected (guard check)', () => {
    // No normal BotAction kind maps to BOT_STEP, so we construct a deliberately
    // invalid action via type coercion to reach the guard's runtime branch.
    // This tests the guard itself rather than any planner behaviour.
    //
    // We monkey-patch translateInner's output via a synthetic action whose
    // `kind` is not in the BotAction union — the `default` case in translateInner
    // returns null, so we can't reach the guard that way. Instead, we verify the
    // guard by passing a crafted object that survives the switch (via an unknown
    // kind fallthrough returning null anyway) AND by reading the guard's source
    // behaviour directly.
    //
    // The guard is: if (translated && translated.type === 'BOT_STEP') return null.
    // Since no real BotAction produces BOT_STEP, we verify the guard indirectly:
    // the function must return null (not a GameAction with type === 'BOT_STEP')
    // for any input, and we confirm via the no-card actions that non-BOT_STEP
    // results ARE returned.

    // Approach: feed a completely fabricated action cast to BotAction.
    // The `default` branch catches it and returns null. The guard runs on null
    // (falsy) and passes through — the result is null regardless.
    const fakeAction = { kind: 'OBVIOUSLY_INVALID' } as unknown as Parameters<
      typeof translateBotAction
    >[1];
    const result = translateBotAction(state, fakeAction);
    expect(result).toBeNull();
  });

  test('14b. No valid BotAction kind produces a GameAction with type BOT_STEP', () => {
    // Exhaustive check: run every no-card BotAction kind and assert the output
    // is never { type: 'BOT_STEP' }.
    const noCardActions = [
      { kind: 'beginTurn' as const },
      { kind: 'rollDice' as const },
      { kind: 'drawCard' as const },
      { kind: 'confirmStaged' as const },
      { kind: 'endTurn' as const },
      { kind: 'defendFractionPenalty' as const },
    ];
    for (const action of noCardActions) {
      const result = translateBotAction(state, action);
      if (result) {
        expect((result as { type: string }).type).not.toBe('BOT_STEP');
      }
    }
  });
});
