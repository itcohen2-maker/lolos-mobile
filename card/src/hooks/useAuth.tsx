import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;
  slinda_owned: boolean;
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
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        fetchProfile(s.user.id);
        setLoading(false);
      } else {
        // Auto sign-in anonymously — every player gets a stable identity
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.warn('[auth] signInAnonymously failed:', error.message);
          setLoading(false);
        } else if (data.session) {
          setSession(data.session);
          fetchProfile(data.session.user.id);
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
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
