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

});
