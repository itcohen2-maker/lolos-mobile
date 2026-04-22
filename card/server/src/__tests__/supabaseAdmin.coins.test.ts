const mockRpc = jest.fn().mockResolvedValue({ error: null });

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'match-1' }, error: null }),
        }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { rating: 1000, wins: 0, losses: 0, abandons: 0 },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}));

import { awardCoinsForPlayer, recordMatch } from '../supabaseAdmin';

beforeEach(() => {
  mockRpc.mockClear();
});

describe('awardCoinsForPlayer', () => {
  it('calls award_coins_for_player RPC with correct params', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });

    await awardCoinsForPlayer({
      playerId: 'player-uuid',
      amount: 5,
      source: 'game_courage',
      matchId: 'match-uuid',
    });

    expect(mockRpc).toHaveBeenCalledWith('award_coins_for_player', {
      p_player_id: 'player-uuid',
      p_amount: 5,
      p_source: 'game_courage',
      p_match_id: 'match-uuid',
    });
  });

  it('passes null matchId when not provided', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });

    await awardCoinsForPlayer({ playerId: 'player-uuid', amount: 10, source: 'tutorial_core' });

    expect(mockRpc).toHaveBeenCalledWith('award_coins_for_player', {
      p_player_id: 'player-uuid',
      p_amount: 10,
      p_source: 'tutorial_core',
      p_match_id: null,
    });
  });

  it('does not throw when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'DB error' } });

    await expect(
      awardCoinsForPlayer({ playerId: 'p', amount: 5, source: 'game_courage' })
    ).resolves.not.toThrow();
  });
});

describe('recordMatch — coin awarding', () => {
  it('calls award_coins_for_player for participant with coinsEarned > 0', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await recordMatch({
      roomCode: 'ABCD',
      difficulty: 'medium',
      playerCount: 2,
      startedAt: new Date('2026-01-01'),
      winnerId: 'player-1',
      participants: [
        { playerId: 'player-1', delta: 15, coinsEarned: 5 },
        { playerId: 'player-2', delta: -10, coinsEarned: 0 },
      ],
    });

    const coinCalls = mockRpc.mock.calls.filter(
      ([name]: [string]) => name === 'award_coins_for_player'
    );
    expect(coinCalls).toHaveLength(1);
    expect(coinCalls[0][1]).toMatchObject({
      p_player_id: 'player-1',
      p_amount: 5,
      p_source: 'game_courage',
    });
  });

  it('skips coin award when coinsEarned is 0 or omitted', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await recordMatch({
      roomCode: 'EFGH',
      difficulty: null,
      playerCount: 2,
      startedAt: new Date('2026-01-01'),
      winnerId: null,
      participants: [
        { playerId: 'player-1', delta: -10 },
        { playerId: 'player-2', delta: -10 },
      ],
    });

    const coinCalls = mockRpc.mock.calls.filter(
      ([name]: [string]) => name === 'award_coins_for_player'
    );
    expect(coinCalls).toHaveLength(0);
  });
});
