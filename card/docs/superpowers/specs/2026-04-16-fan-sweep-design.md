# Fan Sweep Animation — Design

**Date:** 2026-04-16
**Scope:** Fix the visible "bot scans the hand" animation so it performs a smooth, complete right → left → center sweep in two places: (1) the real in-game bot turn and (2) the tutorial's bot demo for lesson-01-fan.

## Problem

Today the fan sweep is visibly wrong in two places:

1. **In-game bot turn** (`index.tsx:5432`, `botScanOffset` effect): the bot's visual "scan" uses an additive offset capped at ~2.6 cards (`maxScanSpan = clamp(count-1 * 0.45, 0.8, 2.6)`). It never reaches the actual ends of the hand and returns to its starting position (offset 0), not to the middle card. It also uses random jitter on timings, which amplifies the choppy feel.
2. **Tutorial fan demo** (`src/tutorial/lessons/lesson-01-fan.ts`): sequence is `scrollFanTo(0) → scrollFanTo(4) → scrollFanTo(2)` — left, then right, then middle. User wants right first. The tutorial bus handler at `index.tsx:5498` uses `Animated.spring` with `friction: 7, tension: 50`, which bounces on arrival and contributes to the "jumpy" feel. The hardcoded indices (0, 4, 2) also do not adapt to the actual hand length.

The result: the fan does move, but the motion is short, reversed, and bouncy. The user sees neither end and does not land on the middle card.

## Goal

One unified sweep sequence in both places:

1. Sweep to the **right end** so the LAST card (index `N-1`) sits at the visual center.
2. Pause at the right end.
3. Sweep to the **left end** so the FIRST card (index `0`) sits at the visual center.
4. Pause at the left end.
5. Settle at the **middle** so the card at `floor((N-1)/2)` sits at the visual center, with cards visible on both sides.
6. Stop. (In-game only: the existing follow-up that moves toward `botCandidateCardId` still runs after step 5.)

## Approach — chosen: Approach A ("fix in place")

Keep both existing animation mechanisms. Fix the sequence, extent, and smoothness in each. Lowest-risk change, touches three code locations.

- Tutorial demo continues to drive `scrollX` via `tutorialBus.subscribeFanDemo`.
- In-game bot scan continues to drive `botScanOffset` as an additive offset on `scrollX`.

Rejected alternatives:
- **B — shared `sweepFan()` helper** across tutorial and in-game. Cleaner, but requires a new module and larger surface change for no immediate behavior benefit. Defer until a third caller needs it.
- **C — collapse in-game scan onto `scrollX` directly**, abandoning `botScanOffset`. Tempting (it would be simpler), but it breaks the current invariant that the user's scroll position is preserved after the scan. Out of scope for this fix.

## Sequence specification

Let `N = count` (number of cards in the fan). Let `last = N - 1`, `mid = Math.floor((N - 1) / 2)`.

| Step | Target          | Duration | Easing                    |
| ---- | --------------- | -------- | ------------------------- |
| 1    | scanScrollX = last | 900 ms   | `Easing.inOut(Easing.sin)` |
| 2    | pause at right  | 400 ms   | —                         |
| 3    | scanScrollX = 0    | 900 ms   | `Easing.inOut(Easing.sin)` |
| 4    | pause at left   | 400 ms   | —                         |
| 5    | scanScrollX = mid  | 700 ms   | `Easing.out(Easing.cubic)` |

Total: ~3.3 seconds. No random jitter on durations.

**Degenerate cases:**
- `N <= 1`: skip the full sweep (nothing meaningful to show). For `N = 1`, just sit still; for `N = 0`, the effect is already no-op.
- `N === 2`: `mid = 0`. The sequence still makes sense (right=1, left=0, settle=0); keep it.

## Code changes

### 1. `src/tutorial/lessons/lesson-01-fan.ts`

Current body hardcodes indices 0, 4, 2 — assumes 5 cards. The lesson rigging builds a tutorial hand whose length we do not control at author time. The `DemoApi` needs a way to know the hand length so we can compute `last` and `mid` dynamically.

**Extend `DemoApi`** (`src/tutorial/BotDemonstrator.ts`) with a `fanLength()` accessor:
- Source the length from the same place the bus subscriber reads it from in `index.tsx:5498` (`cards.length`). Expose it via a new bus event `requestFanLength` → `reportFanLength`, or (simpler) add a module-level `tutorialBus.getFanLength()` getter that the fan component updates via `tutorialBus.setFanLength(n)` whenever `count` changes.
- Prefer the simple getter approach: minimal new surface; no async dance.

Rewrite `lesson01Fan`:

```ts
steps: [
  {
    id: 'scroll-fan',
    botDemo: async (api) => {
      const n = api.fanLength();
      if (n <= 1) return;
      const last = n - 1;
      const mid = Math.floor(last / 2);
      await api.scrollFanTo(last);
      await api.wait(400);
      await api.scrollFanTo(0);
      await api.wait(400);
      await api.scrollFanTo(mid);
    },
    // ...unchanged
  },
],
```

### 2. Tutorial bus handler — `index.tsx:5498`

Replace `Animated.spring({ friction: 7, tension: 50 })` with `Animated.timing({ duration, easing })`. The duration should match the sweep timings above, but the handler only knows about a single `scrollToIdx` at a time — it does not know which step of the sequence it is in. Accept a `durationMs` and `easing` on the command payload and have the lesson drive them.

**Extend `FanDemoCmd`** (`src/tutorial/tutorialBus.ts`):

```ts
export type FanDemoCmd =
  | { kind: 'scrollToIdx'; idx: number; durationMs?: number; easing?: 'sweep' | 'settle' }
  | { kind: 'pulseCardIdx'; idx: number; durationMs?: number };
```

`easing: 'sweep'` → `Easing.inOut(Easing.sin)` (steps 1, 3).
`easing: 'settle'` → `Easing.out(Easing.cubic)` (step 5).
Default (`undefined`) keeps current spring behavior for any other caller that might exist.

**Extend `BotDemonstrator`** so `scrollFanTo(idx, { durationMs, easing })` forwards them.

**Handler body in `index.tsx`:**

```ts
if (cmd.kind === 'scrollToIdx') {
  const target = Math.max(0, Math.min(cards.length - 1, cmd.idx));
  if (cmd.easing) {
    const easing = cmd.easing === 'settle' ? Easing.out(Easing.cubic) : Easing.inOut(Easing.sin);
    Animated.timing(scrollX, { toValue: target, duration: cmd.durationMs ?? 900, useNativeDriver: true, easing }).start();
  } else {
    Animated.spring(scrollX, { toValue: target, useNativeDriver: true, friction: 7, tension: 50 }).start();
  }
}
```

The lesson then passes the right durations and easings:
- `scrollFanTo(last, { durationMs: 900, easing: 'sweep' })`
- `scrollFanTo(0, { durationMs: 900, easing: 'sweep' })`
- `scrollFanTo(mid, { durationMs: 700, easing: 'settle' })`
- `wait(400)` between them.

### 3. In-game bot scan — `index.tsx:5432–5456`

Replace the current partial-sweep `steps` array. The animation drives `botScanOffset` additively, so the target offsets are computed relative to the current `scrollRef.current`:

```ts
const last = Math.max(0, count - 1);
const mid = Math.floor(last / 2);
const start = scrollRef.current;
const toOffset = (absIdx: number) => absIdx - start;

botScanOffset.setValue(0);
const steps: Animated.CompositeAnimation[] = [
  Animated.timing(botScanOffset, {
    toValue: toOffset(last),
    duration: 900,
    useNativeDriver: true,
    easing: Easing.inOut(Easing.sin),
  }),
  Animated.delay(400),
  Animated.timing(botScanOffset, {
    toValue: toOffset(0),
    duration: 900,
    useNativeDriver: true,
    easing: Easing.inOut(Easing.sin),
  }),
  Animated.delay(400),
  Animated.timing(botScanOffset, {
    toValue: toOffset(mid),
    duration: 700,
    useNativeDriver: true,
    easing: Easing.out(Easing.cubic),
  }),
];
```

After this sequence, the existing `botCandidateCardId` follow-up still appends its own step to move the offset toward the chosen card. The starting offset is now `toOffset(mid)` (not 0). Replace the current clamped target with the unclamped form:

```ts
targetOffset = toOffset(targetIdx);
```

No `maxScanSpan` clamp — the whole point of the fix is that we now go end-to-end. Keep the 180 ms pre-pick delay and the 420 ms `Easing.out(Easing.cubic)` for the final move to the chosen card; only the computed `toValue` changes.

Skip everything if `count <= 1`.

Remove `botTeachingDifficulty` from the duration computation, drop `maxScanSpan` entirely, and remove both from the effect's dependency array since timings are now constants. This also removes the random jitter.

## Testing

- `src/tutorial/__tests__/tutorialFlow.test.ts`: update expectations to match the new sequence (right → left → middle), and read `fanLength()` instead of hardcoded indices.
- `src/tutorial/MimicEngine.test.ts`: not affected (outcome matching only checks `fanScrolled` events).
- Manual smoke:
  - Tutorial lesson-01: start tutorial, watch the bot demo. Verify fan goes right end → pause → left end → pause → middle, smooth, no bounce.
  - In-game vs bot: start single-player vs bot, wait for bot's turn. Verify same sequence, then (if the bot has a candidate) a clean move to the chosen card.

## Non-goals

- No change to how the tutorial advances between lessons.
- No change to the card-pick animation itself (the motion from "middle" to the chosen card).
- No change to the user's own scroll/drag behaviour.
- No refactor into a shared helper (that is approach B, deferred).
