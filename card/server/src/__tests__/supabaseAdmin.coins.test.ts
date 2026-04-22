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
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}));

import { awardCoinsForPlayer } from '../supabaseAdmin';

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
