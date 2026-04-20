// ============================================================
// useAuth.tsx — Authentication context for the app.
// Wraps Supabase Auth: session management, sign-up, sign-in,
// sign-out, and the player's profile (rating, wins, etc.).
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  created_at: string;
}

interface AuthContextValue {
  /** Current Supabase session (null = not logged in). */
  session: Session | null;
  /** Supabase auth user (derived from session). */
  user: User | null;
  /** Player profile from the `profiles` table (null until loaded). */
  profile: PlayerProfile | null;
  /** True while the initial session check is in flight. */
  loading: boolean;
  /** Sign up with email + password + username. */
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  /** Sign in with email + password. */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign out and clear session. */
  signOut: () => Promise<void>;
  /** Reload the profile from the DB (e.g. after a game ends). */
  refreshProfile: () => Promise<void>;
  /** True when the user is authenticated (session exists). */
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;
  const isAuthenticated = !!session;

  // ── Fetch profile from `profiles` table ──
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
      }
    } catch (e) {
      console.warn('[auth] fetchProfile exception:', e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Listen for auth state changes ──
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchProfile(s.user.id);
      setLoading(false);
    });

    // Subscribe to changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Sign up ──
  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }, // Passed to the handle_new_user trigger
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  // ── Sign in ──
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  // ── Sign out ──
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
        signUp,
        signIn,
        signOut: signOutFn,
        refreshProfile,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access the auth context. Must be used inside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
