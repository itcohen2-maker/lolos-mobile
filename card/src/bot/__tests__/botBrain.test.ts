// card/src/bot/__tests__/botBrain.test.ts

import { decideBotAction } from '../botBrain';
import {
  makeFixtureState,
  makePlayer,
  makeCard,
  resetCardSeq,
} from '../fixtures';

beforeEach(() => {
  resetCardSeq();
});

describe('decideBotAction', () => {

  test('returns beginTurn in turn-transition phase', () => {
    const botPlayer = makePlayer(0, 'Bot', []);
    const state = makeFixtureState({
      phase: 'turn-transition',
      players: [botPlayer],
      currentPlayerIndex: 0,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'beginTurn' });
  });

  test('pre-roll plays identical when available', () => {
    const discardCard = makeCard('number', 5);
    const identicalCard = makeCard('number', 5); // same value as discard
    const otherCard = makeCard('number', 3);
    const botPlayer = makePlayer(0, 'Bot', [otherCard, identicalCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'playIdentical', cardId: identicalCard.id });
  });

  test('pre-roll plays attack fraction when available', () => {
    const discardCard = makeCard('number', 6);
    // 1/2 fraction: validateFractionPlay passes because 6 is divisible by 2
    const fractionCard = makeCard('fraction', undefined, '1/2');
    const numberCard = makeCard('number', 3); // value 3 ≠ 6, no identical play
    const botPlayer = makePlayer(0, 'Bot', [numberCard, fractionCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'playFractionAttack', cardId: fractionCard.id });
  });

  test('pre-roll rolls dice as fallback', () => {
    const discardCard = makeCard('number', 7);
    // 7 is not divisible by 2, so 1/2 fraction cannot be played
    const fractionCard = makeCard('fraction', undefined, '1/2');
    const numberCard = makeCard('number', 2); // value 2 ≠ 7, no identical play
    const botPlayer = makePlayer(0, 'Bot', [numberCard, fractionCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'rollDice' });
  });

  test('pre-roll defense uses divisible number card', () => {
    const divisibleCard = makeCard('number', 6); // 6 % 2 === 0 ✓
    const opCard = makeCard('operation', undefined, undefined, '+');
    const botPlayer = makePlayer(0, 'Bot', [opCard, divisibleCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [makeCard('number', 6)],
      pendingFractionTarget: 3,
      fractionPenalty: 2,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({
      kind: 'defendFractionSolve',
      cardId: divisibleCard.id,
      // wildResolve should NOT be present when defending with a plain number card
    });
    // Confirm wildResolve is absent (undefined or not set)
    expect((result as { wildResolve?: number }).wildResolve).toBeUndefined();
  });

  test('pre-roll defense uses wild card with wildResolve', () => {
    const wildCard = makeCard('wild');
    const indivisibleCard = makeCard('number', 5); // 5 % 2 !== 0, not divisible
    const botPlayer = makePlayer(0, 'Bot', [indivisibleCard, wildCard]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [makeCard('number', 4)],
      pendingFractionTarget: 2,
      fractionPenalty: 2,
    });

    const result = decideBotAction(state, 'hard');

    // wildResolve = Math.max(fractionPenalty, 1) = Math.max(2, 1) = 2
    expect(result).toEqual({
      kind: 'defendFractionSolve',
      cardId: wildCard.id,
      wildResolve: 2,
    });
  });

  test('pre-roll defense uses counter-fraction (playFractionBlock)', () => {
    const counterFraction = makeCard('fraction', undefined, '1/2');
    const opCard = makeCard('operation', undefined, undefined, '+');
    const botPlayer = makePlayer(0, 'Bot', [opCard, counterFraction]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [makeCard('number', 4)],
      pendingFractionTarget: 2,
      fractionPenalty: 2,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'playFractionBlock', cardId: counterFraction.id });
  });

  test('pre-roll defense takes penalty when no defense available', () => {
    const opCard1 = makeCard('operation', undefined, undefined, '+');
    const opCard2 = makeCard('operation', undefined, undefined, '-');
    const botPlayer = makePlayer(0, 'Bot', [opCard1, opCard2]);

    const state = makeFixtureState({
      phase: 'pre-roll',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [makeCard('number', 4)],
      pendingFractionTarget: 2,
      fractionPenalty: 2,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'defendFractionPenalty' });
  });

  test('roll-dice phase handled identically to pre-roll', () => {
    const discardCard = makeCard('number', 5);
    const identicalCard = makeCard('number', 5);
    const otherCard = makeCard('number', 3);
    const botPlayer = makePlayer(0, 'Bot', [otherCard, identicalCard]);

    const state = makeFixtureState({
      phase: 'roll-dice',
      players: [botPlayer],
      currentPlayerIndex: 0,
      discardPile: [discardCard],
      pendingFractionTarget: null,
    });

    const result = decideBotAction(state, 'hard');

    // The brain must treat 'roll-dice' the same as 'pre-roll'
    expect(result).toEqual({ kind: 'playIdentical', cardId: identicalCard.id });
  });

  test('building returns confirmEquation with full plan', () => {
    resetCardSeq(); // ensure stable IDs for this test
    const card3 = makeCard('number', 3);
    const card4 = makeCard('number', 4);
    const card2 = makeCard('number', 2);
    const opCard = makeCard('operation', undefined, undefined, '+');
    // Hand order: op first so buildBotCommits picks it up immediately
    const botPlayer = makePlayer(0, 'Bot', [opCard, card3, card4, card2]);

    const state = makeFixtureState({
      phase: 'building',
      players: [botPlayer],
      currentPlayerIndex: 0,
      validTargets: [{ equation: '3+4', result: 7 }],
      enabledOperators: ['+'],
      mathRangeMax: 25,
      discardPile: [makeCard('number', 7)],
    });

    const result = decideBotAction(state, 'hard');

    // Must be a confirmEquation action
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('confirmEquation');

    const action = result as {
      kind: 'confirmEquation';
      target: number;
      equationDisplay: string;
      equationCommits: { cardId: string; position: number; jokerAs: null | string }[];
      equationOps: string[];
      stagedCardIds: ReadonlyArray<string>;
    };

    // Target must match the valid target result
    expect(action.target).toBe(7);
    expect(action.equationDisplay).toBe('3+4');

    // stagedCardIds must include card3 and card4 (the winning subset)
    expect(action.stagedCardIds).toContain(card3.id);
    expect(action.stagedCardIds).toContain(card4.id);
    // card2 should NOT be staged (not needed for the equation)
    expect(action.stagedCardIds).not.toContain(card2.id);

    // equationCommits: one entry for the operation card at position 0
    expect(action.equationCommits).toHaveLength(1);
    expect(action.equationCommits[0].cardId).toBe(opCard.id);
    expect(action.equationCommits[0].position).toBe(0);
    expect(action.equationCommits[0].jokerAs).toBeNull();

    // equationOps: ['+'] derived from the operation card
    expect(action.equationOps).toEqual(['+']);
  });

  test('building falls back to drawCard when no plan', () => {
    const card1 = makeCard('number', 1);
    const card2 = makeCard('number', 2);
    const botPlayer = makePlayer(0, 'Bot', [card1, card2]);

    const state = makeFixtureState({
      phase: 'building',
      players: [botPlayer],
      currentPlayerIndex: 0,
      validTargets: [{ equation: '9', result: 9 }],
      enabledOperators: ['+'],
      mathRangeMax: 25,
      discardPile: [makeCard('number', 9)],
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toEqual({ kind: 'drawCard' });
  });

  test('building plan follows legal target match (not equation-number text lock)', () => {
    resetCardSeq();
    const card7 = makeCard('number', 7);
    const card3 = makeCard('number', 3);
    const card4 = makeCard('number', 4);
    const opCard = makeCard('operation', undefined, undefined, '+');
    const botPlayer = makePlayer(0, 'Bot', [opCard, card7, card3, card4]);

    const state = makeFixtureState({
      phase: 'building',
      players: [botPlayer],
      currentPlayerIndex: 0,
      validTargets: [{ equation: '3+4', result: 7 }],
      enabledOperators: ['+'],
      mathRangeMax: 25,
      discardPile: [makeCard('number', 7)],
    });

    const rng = () => 0;
    const result = decideBotAction(state, 'easy', { rng });

    expect(result).not.toBeNull();
    expect(result!.kind).toBe('confirmEquation');
    const action = result as { kind: 'confirmEquation'; stagedCardIds: ReadonlyArray<string> };
    // Planner now optimizes by legal target match, not strict equation text numbers.
    // With deterministic easy RNG, the first legal subset for target 7 is [7].
    expect(action.stagedCardIds).toContain(card7.id);
  });

  test('game-over returns null', () => {
    const botPlayer = makePlayer(0, 'Bot', []);
    const state = makeFixtureState({
      phase: 'game-over',
      players: [botPlayer],
      currentPlayerIndex: 0,
    });

    const result = decideBotAction(state, 'hard');

    expect(result).toBeNull();
  });

  test('Profile 3: Hard maximizes staged cards; Easy (seeded RNG) picks first enumerated plan', () => {
    resetCardSeq();
    const card1 = makeCard('number', 1);
    const card2 = makeCard('number', 2);
    const card3 = makeCard('number', 3);
    const card4 = makeCard('number', 4);
    const opCard = makeCard('operation', undefined, undefined, '+');

    // Both targets are achievable:
    //   target=3:  staged=[card3]         → score 1 number + 1 op commit = 2
    //   target=10: staged=[card1,2,3,4]   → score 4 numbers + 1 op commit = 5
    const botPlayer = makePlayer(0, 'Bot', [opCard, card1, card2, card3, card4]);

    const baseState = makeFixtureState({
      phase: 'building',
      players: [botPlayer],
      currentPlayerIndex: 0,
      validTargets: [
        { equation: '3', result: 3 },
        { equation: '1+2+3+4', result: 10 },
      ],
      enabledOperators: ['+'],
      mathRangeMax: 25,
      discardPile: [makeCard('number', 5)],
    });

    const hardResult = decideBotAction(baseState, 'hard');
    /** Skip blunder branch, then pick first enumerated plan (deterministic). */
    let easyRngCalls = 0;
    const easyRng = () => {
      easyRngCalls += 1;
      return easyRngCalls === 1 ? 0.5 : 0;
    };
    const easyResult = decideBotAction(baseState, 'easy', { rng: easyRng });

    // Both must produce a plan (not null, not drawCard)
    expect(hardResult).not.toBeNull();
    expect(easyResult).not.toBeNull();
    expect(hardResult!.kind).toBe('confirmEquation');
    expect(easyResult!.kind).toBe('confirmEquation');

    const hardAction = hardResult as { kind: 'confirmEquation'; stagedCardIds: ReadonlyArray<string> };
    const easyAction = easyResult as { kind: 'confirmEquation'; stagedCardIds: ReadonlyArray<string> };

    // Hard maximizes card count → 4 cards staged
    expect(hardAction.stagedCardIds).toHaveLength(4);
    // Easy with seeded RNG picks the first legal subset for target=3.
    // Enumeration order yields [1,2] before [3].
    expect(easyAction.stagedCardIds).toHaveLength(2);
    expect(easyAction.stagedCardIds.length).toBeLessThan(hardAction.stagedCardIds.length);
    expect(easyAction.stagedCardIds).toContain(card1.id);
    expect(easyAction.stagedCardIds).toContain(card2.id);

    // Hard staged all four number cards (1+2+3+4=10 satisfies target=10)
    expect(hardAction.stagedCardIds).toContain(card1.id);
    expect(hardAction.stagedCardIds).toContain(card2.id);
    expect(hardAction.stagedCardIds).toContain(card3.id);
    expect(hardAction.stagedCardIds).toContain(card4.id);
  });

});
