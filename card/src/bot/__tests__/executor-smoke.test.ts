// card/src/bot/__tests__/executor-smoke.test.ts
// Smoke test: proves executor.ts exports translateBotAction and findCardInHand.
// Full per-kind coverage is in executor.test.ts (M4.2).

import { translateBotAction, findCardInHand } from '../executor';
import type { GameState } from '../../../index';

// Minimal GameState fixture — only the fields the translator actually reads.
// Cast via `as unknown as GameState` to avoid constructing the full 60-field interface.
function makeFixtureState(): GameState {
  const card = {
    id: 'c1',
    type: 'number' as const,
    value: 5,
  };

  return {
    currentPlayerIndex: 1,                 // bot is player index 1
    players: [
      { id: 0, name: 'Human', hand: [], calledLolos: false, isBot: false },
      { id: 1, name: 'Bot',   hand: [card], calledLolos: false, isBot: true },
    ],
    // All other fields: use any-cast stubs. The translator only reads
    // state.players and state.currentPlayerIndex.
  } as unknown as GameState;
}

describe('executor smoke tests', () => {
  const state = makeFixtureState();

  test('translateBotAction: beginTurn → BEGIN_TURN', () => {
    const result = translateBotAction(state, { kind: 'beginTurn' });
    expect(result).toEqual({ type: 'BEGIN_TURN' });
  });

  test('findCardInHand: returns card object when id exists in bot hand', () => {
    const card = findCardInHand(state, 'c1');
    expect(card).toBeDefined();
    expect(card?.id).toBe('c1');
    expect(card?.value).toBe(5);
  });

  test('findCardInHand: returns undefined for unknown id', () => {
    const card = findCardInHand(state, 'nonexistent');
    expect(card).toBeUndefined();
  });
});
