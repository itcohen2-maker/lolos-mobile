# Supabase Coins & Player History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist player coins to Supabase so they survive across games, with a full event log and per-match history.

**Architecture:** A new `coin_events` table is the authoritative log. Two Postgres functions handle writes: a server-side `award_coins_for_player` (called by the Node server via service-role at game-over) and a client-side `award_coins` (called by the React Native app for tutorial completion, scoped to `auth.uid()`). The `profiles.total_coins` column is a denormalized read cache of the sum. Historical tutorial coins stored in AsyncStorage are migrated to Supabase once on first login.

**Tech Stack:** Supabase (Postgres + RLS + RPC), Node.js/TypeScript server, React Native + Expo client, Jest for tests, AsyncStorage for local flags.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/002_coins.sql` | All schema changes: columns, table, index, functions |
| Modify | `server/src/supabaseAdmin.ts` | Add `CoinSource` type, `awardCoinsForPlayer()`, extend `RatingUpdate` + `recordMatch()` |
| Create | `server/src/__tests__/supabaseAdmin.coins.test.ts` | Unit tests for coin server logic |
| Modify | `src/hooks/useAuth.tsx` | Add `total_coins` to `PlayerProfile`, add `syncTutorialCoins` |
| Create | `src/hooks/__tests__/useAuth.coins.test.ts` | Unit tests for tutorial coin migration |
| Modify | `src/tutorial/InteractiveTutorialScreen.tsx` | Call `award_coins` RPC when tutorial coin count increments |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_coins.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/002_coins.sql
-- Coins persistence: event log, profile total, per-match earnings

-- 1. Add total_coins to profiles
alter table public.profiles
  add column if not exists total_coins integer not null default 0;

-- 2. Add coins_earned to match_participants
alter table public.match_participants
  add column if not exists coins_earned integer not null default 0;

-- 3. Create coin_events table
create table if not exists public.coin_events (
  id          uuid        primary key default gen_random_uuid(),
  player_id   uuid        not null references public.profiles(id) on delete cascade,
  amount      integer     not null,
  source      text        not null check (source in (
                'game_courage', 'tutorial_core', 'tutorial_advanced', 'tutorial_legacy'
              )),
  match_id    uuid        references public.matches(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 4. Index for idempotency guard and history queries
create index if not exists idx_coin_events_player_source_match
  on public.coin_events (player_id, source, match_id);

-- 5. RLS on coin_events
alter table public.coin_events enable row level security;

create policy "Players read own coin events"
  on public.coin_events for select
  using (auth.uid() = player_id);

create policy "Service role inserts coin events"
  on public.coin_events for insert
  with check (true);

-- 6. Server-side function (called via service-role, no SECURITY DEFINER needed)
create or replace function public.award_coins_for_player(
  p_player_id  uuid,
  p_amount     integer,
  p_source     text,
  p_match_id   uuid default null
) returns void as $$
begin
  if exists (
    select 1 from public.coin_events
    where player_id = p_player_id
      and source = p_source
      and (match_id = p_match_id or (match_id is null and p_match_id is null))
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id)
  values (p_player_id, p_amount, p_source, p_match_id);

  update public.profiles
  set total_coins = total_coins + p_amount
  where id = p_player_id;
end;
$$ language plpgsql;

-- 7. Client-side function (SECURITY DEFINER, derives player from auth.uid())
create or replace function public.award_coins(
  p_amount    integer,
  p_source    text,
  p_match_id  uuid default null
) returns void as $$
declare
  v_player_id uuid := auth.uid();
begin
  if v_player_id is null then return; end if;

  if exists (
    select 1 from public.coin_events
    where player_id = v_player_id
      and source = p_source
      and (match_id = p_match_id or (match_id is null and p_match_id is null))
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id)
  values (v_player_id, p_amount, p_source, p_match_id);

  update public.profiles
  set total_coins = total_coins + p_amount
  where id = v_player_id;
end;
$$ language plpgsql security definer;
```

- [ ] **Step 2: Apply migration to Supabase**

Open the Supabase dashboard → SQL Editor → paste the file contents and run. Verify in Table Editor that:
- `profiles` has a `total_coins` column (default 0)
- `match_participants` has a `coins_earned` column (default 0)
- `coin_events` table exists with all columns
- Both functions appear under Database → Functions

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_coins.sql
git commit -m "feat(db): add coins schema — coin_events table, award_coins functions, profile total"
```

---

## Task 2: Server — CoinSource Type + `awardCoinsForPlayer`

**Files:**
- Modify: `server/src/supabaseAdmin.ts`
- Create: `server/src/__tests__/supabaseAdmin.coins.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/__tests__/supabaseAdmin.coins.test.ts`:

```typescript
// Mock must use variables starting with "mock" so Jest hoisting allows them
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

import { awardCoinsForPlayer, supabaseAdmin } from '../supabaseAdmin';

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest __tests__/supabaseAdmin.coins.test.ts --no-coverage
```

Expected: FAIL — `awardCoinsForPlayer` is not exported from `supabaseAdmin`.

- [ ] **Step 3: Add `CoinSource` type and `awardCoinsForPlayer` to `server/src/supabaseAdmin.ts`**

Add after the existing imports and before `// ── Rating helpers ──`:

```typescript
// ── Coin helpers ──

export type CoinSource = 'game_courage' | 'tutorial_core' | 'tutorial_advanced' | 'tutorial_legacy';

/**
 * Award coins to a player by calling the award_coins_for_player Postgres function.
 * Idempotent: safe to call twice for the same (player, source, match) combination.
 * Skipped silently for guest players (no playerId).
 */
export async function awardCoinsForPlayer(opts: {
  playerId: string;
  amount: number;
  source: CoinSource;
  matchId?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('award_coins_for_player', {
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx jest __tests__/supabaseAdmin.coins.test.ts --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add server/src/supabaseAdmin.ts server/src/__tests__/supabaseAdmin.coins.test.ts
git commit -m "feat(server): add CoinSource type and awardCoinsForPlayer helper"
```

---

## Task 3: Server — Extend `recordMatch` to Award Coins

**Files:**
- Modify: `server/src/supabaseAdmin.ts` (extend `RatingUpdate` interface and `recordMatch`)
- Modify: `server/src/__tests__/supabaseAdmin.coins.test.ts` (add recordMatch coins test)

- [ ] **Step 1: Write the failing test**

Append to `server/src/__tests__/supabaseAdmin.coins.test.ts`:

```typescript
describe('recordMatch — coin awarding', () => {
  it('calls awardCoinsForPlayer for each participant with coinsEarned > 0', async () => {
    // recordMatch inserts a match row and participant rows.
    // We verify the rpc is called for participants who earned coins.
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

    // award_coins_for_player should be called once (player-1 only — player-2 earned 0)
    const coinCalls = mockRpc.mock.calls.filter(
      ([name]) => name === 'award_coins_for_player'
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
      ([name]) => name === 'award_coins_for_player'
    );
    expect(coinCalls).toHaveLength(0);
  });
});
```

Add the missing import at the top of the test file (after the mock):

```typescript
import { awardCoinsForPlayer, supabaseAdmin, recordMatch } from '../supabaseAdmin';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest __tests__/supabaseAdmin.coins.test.ts --no-coverage
```

Expected: FAIL — `recordMatch` doesn't accept or use `coinsEarned`.

- [ ] **Step 3: Extend `RatingUpdate` interface in `server/src/supabaseAdmin.ts`**

Find the existing `RatingUpdate` interface and add `coinsEarned`:

```typescript
interface RatingUpdate {
  playerId: string;
  delta: number;
  abandoned?: boolean;
  coinsEarned?: number;  // coins earned by this player this match (0 = none)
}
```

- [ ] **Step 4: Extend the participant loop in `recordMatch` to award coins and record `coins_earned`**

Inside `recordMatch`, replace the existing `match_participants` insert:

```typescript
// Insert participant row (now includes coins_earned)
await supabaseAdmin.from('match_participants').insert({
  match_id: match.id,
  player_id: p.playerId,
  rating_before: ratingBefore,
  rating_after: ratingAfter,
  abandoned: p.abandoned ?? false,
  coins_earned: p.coinsEarned ?? 0,
});
```

Then add the coin award call immediately after the profile update (still inside the `for` loop):

```typescript
// Award coins if this player earned any this match
if ((p.coinsEarned ?? 0) > 0) {
  await awardCoinsForPlayer({
    playerId: p.playerId,
    amount: p.coinsEarned!,
    source: 'game_courage',
    matchId: match.id,
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd server && npx jest __tests__/supabaseAdmin.coins.test.ts --no-coverage
```

Expected: PASS — all 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add server/src/supabaseAdmin.ts server/src/__tests__/supabaseAdmin.coins.test.ts
git commit -m "feat(server): recordMatch awards coins per participant via award_coins_for_player"
```

---

## Task 4: Server — Pass `coinsEarned` from Game Engine to `recordMatch`

**Files:**
- Modify: `server/src/gameEngine.ts` (find where `recordMatch` is called and pass `courageCoins`)

- [ ] **Step 1: Find the recordMatch call**

```bash
grep -n "recordMatch" server/src/gameEngine.ts
```

Note the line number. Open `server/src/gameEngine.ts` at that line.

- [ ] **Step 2: Locate where `courageCoins` is available per player in the final game state**

`ServerGameState.courageCoins` is a single number shared across the game (not per-player). Each player in the game at end-of-game shares this value. Look at how the `participants` array is built for `recordMatch`. It uses `players` from the final game state.

- [ ] **Step 3: Pass `coinsEarned` into each participant entry**

Find the code that builds the `participants` array for `recordMatch`. It will look something like:

```typescript
participants: players.map(p => ({
  playerId: p.id,
  delta: p.id === winnerId ? RATING_WIN : -RATING_LOSS,
  abandoned: false,
}))
```

Add `coinsEarned` — each player who was in the game gets the final `courageCoins` value (these are coins everyone earned collectively from the shared courage meter):

```typescript
participants: players.map(p => ({
  playerId: p.id,
  delta: p.id === winnerId ? RATING_WIN : -RATING_LOSS,
  abandoned: false,
  coinsEarned: state.courageCoins ?? 0,
}))
```

- [ ] **Step 4: Verify the server builds without TypeScript errors**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/gameEngine.ts
git commit -m "feat(server): pass courageCoins to recordMatch so coins are saved at game-over"
```

---

## Task 5: Client — `PlayerProfile.total_coins` + Tutorial Coin Migration

**Files:**
- Modify: `src/hooks/useAuth.tsx`
- Create: `src/hooks/__tests__/useAuth.coins.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useAuth.coins.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mocks
const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'u1', username: 'test', rating: 1000, wins: 0, losses: 0, abandons: 0, total_coins: 0, created_at: '' },
            error: null,
          }),
        }),
      }),
    }),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { syncTutorialCoins } from '../../hooks/useAuth';

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRpc.mockClear();
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

    expect(mockRpc).toHaveBeenCalledWith('award_coins', {
      p_amount: 10,
      p_source: 'tutorial_core',
    });
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

    await syncTutorialCoins(); // should not throw

    const synced = await AsyncStorage.getItem('lulos_tutorial_coins_synced');
    expect(synced).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/hooks/__tests__/useAuth.coins.test.ts --no-coverage
```

Expected: FAIL — `syncTutorialCoins` is not exported from `useAuth`.

- [ ] **Step 3: Add `total_coins` to `PlayerProfile` in `src/hooks/useAuth.tsx`**

Find the `PlayerProfile` interface (line 11) and add the field:

```typescript
export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;  // add this
  created_at: string;
}
```

- [ ] **Step 4: Add `syncTutorialCoins` to `src/hooks/useAuth.tsx`**

Add this import at the top of `useAuth.tsx` (AsyncStorage is already used in the project, just add the import if not present):

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

Add this function (exported so it can be tested) before the `AuthProvider` component:

```typescript
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
```

- [ ] **Step 5: Call `syncTutorialCoins` from `fetchProfile` on success**

In the `fetchProfile` callback (around line 53), add the sync call after `setProfile`:

```typescript
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
      void syncTutorialCoins(); // fire-and-forget migration — safe to fail
    }
  } catch (e) {
    console.warn('[auth] fetchProfile exception:', e);
    setProfile(null);
  }
}, []);
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest src/hooks/__tests__/useAuth.coins.test.ts --no-coverage
```

Expected: PASS — 5 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAuth.tsx src/hooks/__tests__/useAuth.coins.test.ts
git commit -m "feat(client): add total_coins to PlayerProfile and tutorial coin migration on login"
```

---

## Task 6: Client — Award Coins on Tutorial Completion

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

The tutorial screen already increments `tutorialCoinsEarnedCount` in AsyncStorage when `engine.phase === 'core-complete'`. We add the real-time RPC call in the same effect, right after the AsyncStorage write.

- [ ] **Step 1: Add supabase import to `InteractiveTutorialScreen.tsx`**

Find the existing imports at the top of the file and add:

```typescript
import { supabase } from '../lib/supabase';
```

(Check if it's already imported — only add if missing.)

- [ ] **Step 2: Extend the `tutorialCoinsEarnedCount` setter to fire the RPC**

Find this block (around line 384):

```typescript
setTutorialCoinsEarnedCount((prev) => {
  if (prev >= 2) return prev;
  const next = prev + 1;
  void AsyncStorage.setItem(TUTORIAL_COINS_KEY, String(next));
  return next;
});
```

Replace it with:

```typescript
setTutorialCoinsEarnedCount((prev) => {
  if (prev >= 2) return prev;
  const next = prev + 1;
  void AsyncStorage.setItem(TUTORIAL_COINS_KEY, String(next));
  if (next === 1) {
    void supabase.rpc('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
  } else if (next === 2) {
    void supabase.rpc('award_coins', { p_amount: 20, p_source: 'tutorial_advanced' });
  }
  return next;
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat(tutorial): call award_coins RPC on tutorial completion so coins persist immediately"
```

---

## Task 7: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all existing tests still pass plus the new coin tests.

- [ ] **Step 2: Run server tests**

```bash
cd server && npx jest --no-coverage
```

Expected: all passing.

---

## Task 8: Manual Smoke Test

- [ ] **Step 1: Play a game and earn courage coins**

Start the dev server, play a game, fill the courage meter to trigger coins, finish the game. In the Supabase Table Editor:
- Check `coin_events`: a row with `source = 'game_courage'` and your player ID should exist.
- Check `profiles`: `total_coins` should be > 0.
- Check `match_participants`: `coins_earned` should be > 0 for your player.

- [ ] **Step 2: Complete the tutorial**

Go through the tutorial until the coin celebration fires. In Supabase:
- Check `coin_events`: a row with `source = 'tutorial_core'` should appear.

- [ ] **Step 3: Verify migration does not double-count**

Sign out and sign back in. In Supabase, check `coin_events` — the `tutorial_core` row should NOT be duplicated. `profiles.total_coins` should be unchanged.

- [ ] **Step 4: Verify guest players don't error**

If the app supports guests, start a game without signing in, complete it, confirm no server errors in the Node.js logs related to coin awarding.
