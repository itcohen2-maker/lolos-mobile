// ============================================================
// supabaseAdmin.ts — Server-side Supabase client with the
// service-role key. Used for DB writes (rating updates, match
// records) and JWT verification. Never expose this key to the
// client.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { LobbyTableTheme } from '../../shared/types';

const url = process.env.SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const hasSupabaseAdminConfig = !!(url && serviceRoleKey);

if (!hasSupabaseAdminConfig) {
  console.warn(
    '[supabaseAdmin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. ' +
    'Rating updates and match recording will not work.'
  );
}

export const supabaseAdmin = hasSupabaseAdminConfig
  ? createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

function adminUnavailable(context: string): boolean {
  if (supabaseAdmin) return false;
  console.warn(`[supabaseAdmin] Skipping ${context}: admin client is not configured.`);
  return true;
}

const LOBBY_TABLE_THEMES = new Set<LobbyTableTheme>(['classic', 'royal', 'forest', 'ocean']);

function normalizeLobbyTableTheme(raw: unknown): LobbyTableTheme {
  return typeof raw === 'string' && LOBBY_TABLE_THEMES.has(raw as LobbyTableTheme)
    ? (raw as LobbyTableTheme)
    : 'classic';
}

export async function fetchPlayerActiveTableTheme(userId: string): Promise<LobbyTableTheme> {
  if (adminUnavailable(`fetchPlayerActiveTableTheme(${userId})`)) return 'classic';
  try {
    const { data, error } = await supabaseAdmin!
      .from('profiles')
      .select('active_table_theme')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[supabaseAdmin] fetchPlayerActiveTableTheme:', error.message);
      return 'classic';
    }

    return normalizeLobbyTableTheme(data?.active_table_theme);
  } catch (err) {
    console.error('[supabaseAdmin] fetchPlayerActiveTableTheme exception:', err);
    return 'classic';
  }
}

// ── Coin helpers ──

export type CoinSource = 'game_courage' | 'tutorial_core' | 'tutorial_advanced' | 'tutorial_legacy';

/**
 * Award coins to a player via the award_coins_for_player Postgres function.
 * Idempotent: safe to call twice for the same (player, source, match) combination.
 */
export async function awardCoinsForPlayer(opts: {
  playerId: string;
  amount: number;
  source: CoinSource;
  matchId?: string;
}): Promise<void> {
  if (adminUnavailable('awardCoinsForPlayer')) return;
  try {
    const { error } = await supabaseAdmin!.rpc('award_coins_for_player', {
      p_player_id: opts.playerId,
      p_amount: opts.amount,
      p_source: opts.source,
      p_match_id: opts.matchId ?? null,
    });
    if (error) console.error('[supabaseAdmin] awardCoinsForPlayer:', error.message);
  } catch (err) {
    console.error('[supabaseAdmin] awardCoinsForPlayer exception:', err);
  }
}

// ── Rating helpers ──

const RATING_WIN = 15;
const RATING_LOSS = 10;
const RATING_ABANDON_PENALTY = 30;
const MIN_RATING = 0;

function clampRating(r: number): number {
  return Math.max(MIN_RATING, r);
}

interface RatingUpdate {
  playerId: string;
  delta: number;
  abandoned?: boolean;
  coinsEarned?: number;
}

/**
 * Record a completed match and update all participants' ratings.
 * Called from socketHandlers on game-over or abandon.
 */
export async function recordMatch(opts: {
  roomCode: string;
  difficulty: string | null;
  playerCount: number;
  startedAt: Date;
  winnerId: string | null;
  participants: RatingUpdate[];
}): Promise<void> {
  if (adminUnavailable('recordMatch')) return;
  try {
    // 1. Insert match
    const { data: match, error: matchErr } = await supabaseAdmin!
      .from('matches')
      .insert({
        room_code: opts.roomCode,
        difficulty: opts.difficulty,
        player_count: opts.playerCount,
        started_at: opts.startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        winner_id: opts.winnerId,
      })
      .select('id')
      .single();

    if (matchErr || !match) {
      console.error('[supabaseAdmin] insert match failed:', matchErr?.message);
      return;
    }

    // 2. For each participant: read current rating, compute new, insert row, update profile
    for (const p of opts.participants) {
      const { data: profile } = await supabaseAdmin!
        .from('profiles')
        .select('rating, wins, losses, abandons')
        .eq('id', p.playerId)
        .single();

      if (!profile) continue;

      const ratingBefore = profile.rating;
      const ratingAfter = clampRating(ratingBefore + p.delta);

      // Insert participant row
      await supabaseAdmin!.from('match_participants').insert({
        match_id: match.id,
        player_id: p.playerId,
        rating_before: ratingBefore,
        rating_after: ratingAfter,
        abandoned: p.abandoned ?? false,
        coins_earned: p.coinsEarned ?? 0,
      });

      // Update profile
      const updates: Record<string, number> = { rating: ratingAfter };
      if (p.delta > 0) updates.wins = profile.wins + 1;
      else if (p.abandoned) updates.abandons = profile.abandons + 1;
      else updates.losses = profile.losses + 1;

      await supabaseAdmin!
        .from('profiles')
        .update(updates)
        .eq('id', p.playerId);

      if ((p.coinsEarned ?? 0) > 0) {
        await awardCoinsForPlayer({
          playerId: p.playerId,
          amount: p.coinsEarned!,
          source: 'game_courage',
          matchId: match.id,
        });
      }
    }
  } catch (err) {
    console.error('[supabaseAdmin] recordMatch exception:', err);
  }
}

/** Apply abandonment penalty to a single player (disconnect grace expired). */
export async function penalizeAbandon(playerId: string, roomCode: string): Promise<void> {
  if (adminUnavailable(`penalizeAbandon(${roomCode})`)) return;
  try {
    const { data: profile } = await supabaseAdmin!
      .from('profiles')
      .select('rating, abandons')
      .eq('id', playerId)
      .single();

    if (!profile) return;

    const ratingAfter = clampRating(profile.rating - RATING_ABANDON_PENALTY);

    await supabaseAdmin!
      .from('profiles')
      .update({
        rating: ratingAfter,
        abandons: profile.abandons + 1,
      })
      .eq('id', playerId);

    console.log(`[supabaseAdmin] penalizeAbandon: ${playerId} rating ${profile.rating} → ${ratingAfter}`);
  } catch (err) {
    console.error('[supabaseAdmin] penalizeAbandon exception:', err);
  }
}

export { RATING_WIN, RATING_LOSS, RATING_ABANDON_PENALTY };
