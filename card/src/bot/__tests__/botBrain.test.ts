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

});
