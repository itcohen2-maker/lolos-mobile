import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn().mockResolvedValue({ error: null }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'u1',
              username: 'test',
              rating: 1000,
              wins: 0,
              losses: 0,
              abandons: 0,
              total_coins: 0,
              created_at: '',
            },
            error: null,
          }),
        }),
      }),
    }),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { syncTutorialCoins } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRpc = supabase.rpc as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRpc.mockClear();
  mockRpc.mockResolvedValue({ error: null });
});

describe('syncTutorialCoins', () => {
  it('does nothing when no tutorial coins in AsyncStorage', async () => {
    await syncTutorialCoins();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does nothing when already synced', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '1');
    await AsyncStorage.setItem('lulos_tutorial_coins_synced', 'true');
    await syncTutorialCoins();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('awards tutorial_core (10 coins) when count = 1', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '1');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('awards tutorial_core + tutorial_advanced when count = 2', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '2');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 20, p_source: 'tutorial_advanced' });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('uses tutorial_legacy fallback for unexpected count', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '5');
    await syncTutorialCoins();
    expect(mockRpc).toHaveBeenCalledWith('award_coins', { p_amount: 50, p_source: 'tutorial_legacy' });
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBe('true');
  });

  it('leaves synced flag unset if RPC fails so it retries on next login', async () => {
    await AsyncStorage.setItem('lulos_tutorial_coins_earned_count', '1');
    mockRpc.mockRejectedValueOnce(new Error('network error'));
    await syncTutorialCoins();
    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBeNull();
  });
});
