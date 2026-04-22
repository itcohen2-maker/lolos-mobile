# Supabase Coins & Player History — Design Spec
**Date:** 2026-04-22  
**Status:** Approved

---

## Overview

Coins (`courageCoins`) are earned during gameplay from courage meter milestones and during the tutorial, but are currently never persisted — they vanish when a game ends. This spec defines how to store a player's lifetime coin total and a full coin event log in Supabase, and how to surface per-match coin earnings inside the existing match history.

Supabase auth, profiles, and match history are already integrated. This work extends the existing schema and server-side `recordMatch()` flow.

---

## Schema Changes

### `profiles` — add one column
```sql
total_coins  integer  NOT NULL DEFAULT 0
```
Denormalized running total for fast HUD reads. Always equals `SUM(amount)` in `coin_events` for that player.

### `match_participants` — add one column
```sql
coins_earned  integer  NOT NULL DEFAULT 0
```
Coins earned by this player in this specific match. Populated by the server at game-over alongside the existing rating write.

### New table: `coin_events`
```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
player_id   uuid        NOT NULL REFERENCES profiles(id)
amount      integer     NOT NULL          -- always positive (no spending yet)
source      text        NOT NULL CHECK (source IN ('game_courage', 'tutorial_core', 'tutorial_advanced', 'tutorial_legacy'))
match_id    uuid        REFERENCES matches(id)  -- NULL for tutorial events
created_at  timestamptz NOT NULL DEFAULT now()
```

```sql
-- Required for idempotency guard and history queries
CREATE INDEX ON coin_events (player_id, source, match_id);
```

**RLS:** `coin_events` is readable by the owning player only (`player_id = auth.uid()`). All writes go through the server's service-role client (`supabaseAdmin`) — clients never write directly, except for tutorial coin sync which uses a restricted RPC.

**Migration file:** All schema changes (new columns, new table, index, function) go in `supabase/migrations/002_coins.sql`.

---

## Data Flow

### Game-over (server — inside existing `recordMatch()`)
1. Read `courageCoins` from the final game state per player.
2. Skip any player with no auth identity (guests) — coin recording requires a Supabase user ID.
3. For each authenticated player who earned coins, call `award_coins(p_amount, 'game_courage', match_id)` via the service-role client. This single call atomically inserts the `coin_events` row and increments `profiles.total_coins`.
4. Set `coins_earned` on each player's `match_participants` row (separate update alongside the existing rating write).

### Tutorial completion (client — inside `InteractiveTutorialScreen`)
- After the reward fires, call Supabase RPC `award_coins(player_id, amount, source)` using the user's session token (not service role).
- Write `tutorial_coins_synced: true` to AsyncStorage immediately after a successful call.

### Tutorial one-time migration (client — inside `useAuth.refreshProfile()`)
- On login, check AsyncStorage for un-synced tutorial coins (existing `TUTORIAL_COINS_KEY` + absence of `tutorial_coins_synced` flag).
- The existing key stores a count (1 or 2) representing how many tutorial coin events fired. Apply this rule:
  - count = 1 → call `award_coins(10, 'tutorial_core')` (core tutorial only)
  - count = 2 → call `award_coins(10, 'tutorial_core')` then `award_coins(20, 'tutorial_advanced')` (both tutorials)
  - any other value → award `count × 10` as source `'tutorial_legacy'` (safety fallback for unexpected state)
- Write `tutorial_coins_synced: true` to AsyncStorage only after all calls succeed.
- Silent background operation — no UI feedback on failure; retries automatically on next login.

### Client HUD
- `useAuth` already fetches the full profile on login — `total_coins` rides along for free with no extra query.

---

## `award_coins` Postgres Function

Two calling paths exist — server (service-role, trusted) and client (tutorial sync, session-scoped):

**Server path** — called via `supabaseAdmin` with an explicit player ID:
```sql
CREATE OR REPLACE FUNCTION award_coins_for_player(
  p_player_id  uuid,
  p_amount     integer,
  p_source     text,
  p_match_id   uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM coin_events
    WHERE player_id = p_player_id
      AND source = p_source
      AND (match_id = p_match_id OR (match_id IS NULL AND p_match_id IS NULL))
  ) THEN RETURN; END IF;

  INSERT INTO coin_events (player_id, amount, source, match_id)
  VALUES (p_player_id, p_amount, p_source, p_match_id);

  UPDATE profiles SET total_coins = total_coins + p_amount WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;
-- No SECURITY DEFINER — service-role already bypasses RLS
```

**Client path** — called via session RPC for tutorial sync; derives player identity from `auth.uid()` so a client can never award coins to another player:
```sql
CREATE OR REPLACE FUNCTION award_coins(
  p_amount    integer,
  p_source    text,
  p_match_id  uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_player_id uuid := auth.uid();
BEGIN
  IF v_player_id IS NULL THEN RETURN; END IF; -- guest, no-op

  IF EXISTS (
    SELECT 1 FROM coin_events
    WHERE player_id = v_player_id
      AND source = p_source
      AND (match_id = p_match_id OR (match_id IS NULL AND p_match_id IS NULL))
  ) THEN RETURN; END IF;

  INSERT INTO coin_events (player_id, amount, source, match_id)
  VALUES (v_player_id, p_amount, p_source, p_match_id);

  UPDATE profiles SET total_coins = total_coins + p_amount WHERE id = v_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER only on the client-facing function; player_id is always auth.uid()
```

---

## Error Handling

**Server (game-over):**
- Coin write is wrapped in the same try/catch as `recordMatch()`. A failure logs the error but does not crash the game or block match recording. Coins are non-critical additive data.
- Idempotency guard in `award_coins` makes a retry safe if needed.

**Client (tutorial sync):**
- If the RPC call fails, `tutorial_coins_synced` stays unset — automatic retry on next login.
- No error shown to the user.

---

## Testing

### Unit tests
- `award_coins` logic: mock Supabase client; assert correct `coin_events` insert and `profiles.total_coins` increment.
- Tutorial sync in `useAuth`: mock AsyncStorage + Supabase; assert sync runs once and sets flag; assert it does NOT run if flag already set.

### Integration tests
- Extend `recordMatch()` test path: assert `coin_events` rows created and `match_participants.coins_earned` populated.
- Idempotency: call `award_coins` twice with same `(player_id, match_id, source)` — assert one event row and one increment only.

### Manual smoke tests
1. Play a game, reach a courage milestone, finish — verify `total_coins` on profile increased and `coin_events` row exists.
2. Complete tutorial — verify coins appear in profile, AsyncStorage flag is set.
3. Log out and log in — verify tutorial sync does NOT fire again.

---

## Out of Scope
- Coin spending (no spend actions exist yet; add when a spend feature is designed)
- Separate spendable balance vs. lifetime total (will be introduced when spending is in scope)
- Leaderboard UI (depends on this data being stored; UI is a separate feature)
