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

});
