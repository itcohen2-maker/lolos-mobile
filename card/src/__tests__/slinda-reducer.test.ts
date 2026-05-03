import { gameReducer, initialState } from '../../index';
import type { Card, GameAction, GameState } from '../../index';

const tf = (key: string): string => key;

function turnTransitionState(hand: Card[], overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState,
    phase: 'turn-transition',
    currentPlayerIndex: 0,
    players: [
      {
        id: 'p0',
        name: 'T',
        hand,
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
    discardPile: [],
    hasPlayedCards: false,
    selectedCards: [],
    equationHandSlots: [null, null],
    equationHandPick: null,
    ...overrides,
  };
}

describe('slinda replacement reducer', () => {
  it('replaces the selected hand card with a joker and moves the old card to discard without marking a turn play', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 7 };
    const operationCard: Card = { id: 'o1', type: 'operation', operation: '+' };
    const st = turnTransitionState([numberCard, operationCard]);

    const next = gameReducer(
      st,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'o1' } as GameAction,
      tf,
    );

    expect(next.players[0].hand).toHaveLength(2);
    expect(next.players[0].hand[0]).toEqual(numberCard);
    expect(next.players[0].hand[1].type).toBe('joker');
    expect(next.players[0].hand[1].id).not.toBe('o1');
    expect(next.discardPile[next.discardPile.length - 1]).toEqual(operationCard);
    expect(next.hasPlayedCards).toBe(false);
    expect(next.selectedCards).toEqual([]);
    expect(next.equationHandSlots).toEqual([null, null]);
    expect(next.equationHandPick).toBeNull();
  });

  it('is a no-op when the selected card is not in the current player hand', () => {
    const numberCard: Card = { id: 'n1', type: 'number', value: 4 };
    const st = turnTransitionState([numberCard]);

    const next = gameReducer(
      st,
      { type: 'REPLACE_CARD_WITH_SLINDA', cardId: 'missing' } as GameAction,
      tf,
    );

    expect(next).toEqual(st);
  });
});
