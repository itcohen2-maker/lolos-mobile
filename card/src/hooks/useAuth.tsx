import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { TableSkinId } from '../theme/tableSkins';

export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;
  slinda_owned: boolean;
  themes_owned: string[];
  table_skins_owned: string[];
  active_card_back: string;
  active_table_theme: string;
  active_table_skin: string | null;
  created_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: PlayerProfile | null;
  loading: boolean;
  /** True when the session belongs to an anonymous (not-yet-upgraded) user. */
  isAnonymous: boolean;
  /** True when the user is authenticated (session exists). */
  isAuthenticated: boolean;
  /**
   * Links email + password to the current anonymous account, preserving all
   * coins / rating. Falls back to a fresh sign-up if there is no session.
   */
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  /** Sign in with email + password (for users who already linked their account). */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Purchase the Slinda card for 100 coins. Returns 'ok', 'already_owned', or 'insufficient_coins'. */
  purchaseSlinda: () => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'>;
  /** Purchase a theme for 50 coins. */
  purchaseTheme: (themeId: string) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme' | 'error'>;
  /** Purchase a table skin for 40 coins. */
  purchaseTableSkin: (skinId: TableSkinId) => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin' | 'error'>;
  /** Set active card back, table theme, or table skin (must already be owned). */
  setActiveSkin: (kind: 'card_back' | 'table_theme' | 'table_skin', themeId: string) => Promise<'ok' | 'not_owned' | 'invalid' | 'error'>;
  /** Award coins to the current user wallet and refresh local profile cache. */
  awardCoins: (amount: number, source: string) => Promise<'ok' | 'error'>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TUTORIAL_COINS_KEY = 'lulos_tutorial_coins_earned_count';
const TUTORIAL_COINS_SYNCED_KEY = 'lulos_tutorial_coins_synced';

/** Migrate tutorial coins from AsyncStorage to Supabase. One-time, idempotent. */
export async function syncTutorialCoins(): Promise<void> {
  try {
    const [countStr, synced] = await Promise.all([
      AsyncStorage.getItem(TUTORIAL_COINS_KEY),
      AsyncStorage.getItem(TUTORIAL_COINS_SYNCED_KEY),
    ]);
    if (synced === 'true') return;

    const count = parseInt(countStr ?? '0', 10);
    if (isNaN(count) || count <= 0) return;

    if (count === 1) {
      await supabase.rpc('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
    } else if (count === 2) {
      await supabase.rpc('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
      await supabase.rpc('award_coins', { p_amount: 20, p_source: 'tutorial_advanced' });
    } else {
      await supabase.rpc('award_coins', { p_amount: count * 10, p_source: 'tutorial_legacy' });
    }

    await AsyncStorage.setItem(TUTORIAL_COINS_SYNCED_KEY, 'true');
  } catch (err) {
    console.warn('[auth] syncTutorialCoins failed, retrying on next login:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;
  const isAuthenticated = !!session;
  const isAnonymous = user?.is_anonymous === true;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.warn('[auth] fetchProfile error:', error.message);
        setProfile(null);
      } else {
        setProfile(data as PlayerProfile);
        void syncTutorialCoins();
      }
    } catch (e) {
      console.warn('[auth] fetchProfile exception:', e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const s = sessionData?.session ?? null;
        if (s) {
          setSession(s);
          void fetchProfile(s.user.id);
        } else {
          try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
              console.warn('[auth] signInAnonymously failed:', error.message);
            } else if (data?.session) {
              setSession(data.session);
              void fetchProfile(data.session.user.id);
            }
          } catch (e) {
            console.warn('[auth] signInAnonymously threw:', e);
          }
        }
      } catch (e) {
        console.warn('[auth] getSession threw:', e);
      } finally {
        setLoading(false);
      }
    };

    void init();

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s ?? null);
        if (s?.user) {
          void fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      });
      subscription = data?.subscription ?? null;
    } catch (e) {
      console.warn('[auth] onAuthStateChange threw:', e);
    }

    return () => {
      try { subscription?.unsubscribe(); } catch (_) {}
    };
  }, [fetchProfile]);

  /**
   * Links email + password to the current anonymous session (preserving coins/rating).
   * If for some reason there is no session, falls back to a fresh sign-up.
   */
  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (user?.is_anonymous) {
      // Link identity — keeps the same profile row
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) return { error: error.message };
      // Store username in metadata for reference (profile row already exists)
      await supabase.auth.updateUser({ data: { username } });
      await refreshProfile();
      return { error: null };
    }
    // Fresh sign-up (no existing session)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, [user, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const purchaseSlinda = useCallback(async (): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_slinda');
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const purchaseTheme = useCallback(async (themeId: string): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_theme', { theme_id: themeId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_theme';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const purchaseTableSkin = useCallback(async (skinId: TableSkinId): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('purchase_table_skin', { skin_id: skinId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'already_owned' | 'insufficient_coins' | 'invalid_skin';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const setActiveSkin = useCallback(async (kind: 'card_back' | 'table_theme' | 'table_skin', themeId: string): Promise<'ok' | 'not_owned' | 'invalid' | 'error'> => {
    try {
      const { data, error } = await supabase.rpc('set_active_skin', { kind, theme_id: themeId });
      if (error) return 'error';
      const result = data as string;
      if (result === 'ok') await refreshProfile();
      return result as 'ok' | 'not_owned' | 'invalid';
    } catch {
      return 'error';
    }
  }, [refreshProfile]);

  const awardCoins = useCallback(async (amount: number, source: string): Promise<'ok' | 'error'> => {
    if (!Number.isFinite(amount) || amount <= 0) return 'error';
    try {
      const { error } = await supabase.rpc('award_coins', { p_amount: amount, p_source: source });
      if (error) return 'error';
      setProfile((prev) => (prev ? { ...prev, total_coins: (prev.total_coins ?? 0) + amount } : prev));
      return 'ok';
    } catch {
      return 'error';
    }
  }, []);

  const signOutFn = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isAnonymous,
        isAuthenticated,
        signUp,
        signIn,
        signOut: signOutFn,
        refreshProfile,
        purchaseSlinda,
        purchaseTheme,
        purchaseTableSkin,
        setActiveSkin,
        awardCoins,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
