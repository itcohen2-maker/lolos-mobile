# Spec: Meter Animation Blocks Turn Advancement + "בחר קלפים" Button Restore

**Date:** 2026-04-28  
**Status:** Approved

---

## Problem

### 1 — "בחר קלפים" button text changed
In commit `d41b975`, the button in the `solved` phase was renamed from `t('game.pickCards')` ("בחר קלפים") to `t('game.pickCards_revert')` ("ערוך תרגיל") for non-tutorial games. The user expects to see "בחר קלפים" in regular gameplay. Fix: restore the original text.

### 2 — Excellence meter animates after the turn has already advanced
When a player earns a meter step at end of turn, `endTurnLogic` is called synchronously and sets `phase: 'turn-transition'`. React re-renders to `TurnTransition`, which mounts a **new** `ExcellenceMeter` instance. The animation plays during `TurnTransition` rather than before it.

**Desired behaviour:** The turn must not advance until the meter animation (fill + sound) has fully completed.

---

## Design

### State additions (`GameState` in `index.tsx`)

```typescript
meterAnimationPending: boolean        // true = animation running, turn is blocked
pendingTurnState: GameState | null    // frozen endTurnLogic result to apply after animation
```

Both initialise to `false` / `null`.

---

### Helper: `endTurnWithMeterCheck`

Replaces every direct call to `endTurnLogic` across the reducer. Computes the full turn-end state, checks whether the courage meter actually advanced, and returns either the normal turn-end state or a "pending" state that blocks the transition.

```typescript
function endTurnWithMeterCheck(
  st: GameState,
  tf: TranslateFn,
  opts: { originalPulse?: number; extra?: Partial<GameState> } = {}
): GameState {
  const pulse0 = opts.originalPulse ?? (st.courageRewardPulseId ?? 0);
  const baseResult = { ...endTurnLogic(st, tf), ...(opts.extra ?? {}) };
  const cp = st.players[st.currentPlayerIndex];
  const meterAdvanced = (baseResult.courageRewardPulseId ?? 0) > pulse0;

  if (meterAdvanced && !cp?.isBot) {
    // Keep current player + phase; store the transition for after the animation
    return {
      ...st,
      ...(opts.extra ?? {}),
      meterAnimationPending: true,
      pendingTurnState: baseResult,
    };
  }
  return baseResult;
}
```

**`originalPulse` parameter:** used only in `CONFIRM_STAGED` where `applyCourageStepReward` is called *before* `endTurnWithMeterCheck`, so we compare against the pulse before *any* reward in that action.

---

### Reducer changes

#### `CONFIRM_STAGED`
```typescript
case 'CONFIRM_STAGED': {
  const originalPulse = st.courageRewardPulseId ?? 0;
  // ... existing card-play logic (unchanged) ...
  if (usedAllDice) stNs = applyCourageStepReward(stNs, tf('courage.reason.fullEquation'));
  stNs = { ...stNs, courageDiscardSuccessStreak: newStreak };
  return endTurnWithMeterCheck(stNs, tf, {
    originalPulse,
    extra: { lastDiscardCount: stIds.size },
  });
}
```

#### All other `endTurnLogic` call sites (7 total)
Simple substitution — no `originalPulse` needed since no prior `applyCourageStepReward`:
```typescript
// before:
return endTurnLogic(st, tf);
// after:
return endTurnWithMeterCheck(st, tf);
```
Exact call sites (7):
- `END_TURN` (line 2031)
- `DISMISS_IDENTICAL_ALERT` (line 1770)
- `PLAY_IDENTICAL` auto-end-turn path (line 1778)
- Fraction-defence path A (line 1977)
- Fraction-defence path B (line 1994)
- Fraction-defence path C (line 2018)
- `CONFIRM_STAGED` identical-alert branch (line 1738) — uses `extra` param for `lastDiscardCount`

#### New action: `METER_ANIMATION_DONE`
```typescript
case 'METER_ANIMATION_DONE': {
  if (!st.meterAnimationPending || !st.pendingTurnState) return st;
  return {
    ...st.pendingTurnState,
    meterAnimationPending: false,
    pendingTurnState: null,
  };
}
```

Add `{ type: 'METER_ANIMATION_DONE' }` to the `GameAction` union type.

---

### `components/ExcellenceMeter.tsx` changes

#### 1 — New prop
```typescript
type Props = {
  // ... existing ...
  onAnimationComplete?: () => void;
};
```

#### 2 — Re-add `isFirstMount` guard (removed in `d891f8c`, must return)
Prevents `TurnTransition`'s freshly mounted `ExcellenceMeter` from replaying the animation that already completed in `GameScreen`.

```typescript
useEffect(() => {
  if (pulseKey === undefined || pulseKey === prevPulse.current) {
    prevValue.current = value;
    return;
  }
  const isFirstMount = prevPulse.current === undefined;
  prevPulse.current = pulseKey;

  if (isFirstMount) {
    prevValue.current = value;
    return; // silent sync — no animation, no sound
  }

  const celebrate = isCelebrating || (prevValue.current === 66 && value === 0);
  prevValue.current = value;

  if (celebrate) {
    playCelebrate(onAnimationComplete);
  } else {
    void playSfx('success', { cooldownMs: 0, volumeOverride: 0.55 });
    animFill(value, 420);
    playBounce(onAnimationComplete);
  }
}, [pulseKey]); // eslint-disable-line react-hooks/exhaustive-deps
```

#### 3 — `playBounce` accepts optional callback
```typescript
const playBounce = useCallback((onDone?: () => void) => {
  // ... existing animation setup ...
  Animated.sequence([...]).start(() => { onDone?.(); });
}, [scaleX, scaleY, transY, glow, fireSplash]);
```

#### 4 — `playCelebrate` accepts optional callback
```typescript
const playCelebrate = useCallback((onDone?: () => void) => {
  void playSfx('meterCelebrate', ...);
  // ... existing animation setup ...
  Animated.parallel([...]).start(() => {
    Animated.timing(fillPx, { toValue: 0, duration: 600, useNativeDriver: false }).start(() => {
      onDone?.();
    });
  });
  setTimeout(() => animFill(100, 300), 280); // unchanged
}, [...]);
```

---

### `GameScreen` (in `index.tsx`) changes

#### UI-lock overlay — blocks all touches during animation
```tsx
{state.meterAnimationPending && (
  <View
    pointerEvents="auto"
    style={[StyleSheet.absoluteFillObject, { zIndex: 300, backgroundColor: 'transparent' }]}
  />
)}
```
Reuses the same `zIndex: 300` pattern already in place for `lockUiForBotTurn`.

#### Pass `onAnimationComplete` to both `ExcellenceMeter` instances in `GameScreen`
```tsx
<ExcellenceMeter
  value={hp.courageMeterPercent ?? 0}
  pulseKey={hp.courageRewardPulseId ?? 0}
  isCelebrating={!!hp.lastCourageCoinsAwarded}
  onAnimationComplete={
    state.meterAnimationPending
      ? () => dispatch({ type: 'METER_ANIMATION_DONE' })
      : undefined
  }
/>
```
Both instances in `GameScreen` (lines 10476 and 12670 in current file) receive this prop.

---

### Fix 2: "בחר קלפים" button text (`index.tsx` line 13326)

```tsx
// before:
text={state.isTutorial ? t('game.pickCards') : t('game.pickCards_revert')}
// after:
text={t('game.pickCards')}
```

The `onPress` behaviour (no-op in tutorial, `REVERT_TO_BUILDING` in regular game) is unchanged.

---

## Timing reference

| Animation | Duration before `onAnimationComplete` fires |
|-----------|---------------------------------------------|
| Regular bounce | ~950 ms (sequence: 170 + 250 + 280 + 250) |
| Celebration | ~2300 ms (sequence ~1700 ms + fill-to-0 600 ms) |

---

## Error handling / edge cases

- **Bot turn:** `endTurnWithMeterCheck` checks `!cp?.isBot` — bots never trigger the blocking path.
- **Tutorial:** Tutorial uses the same reducer, so meter animation will also block in tutorial. This is correct per the requirement.
- **Online multiplayer:** The blocking path only runs for the local human player (`!cp?.isBot` covers the server-driven bot; the human player's turn runs normally). No server-side changes needed.
- **`METER_ANIMATION_DONE` arrives with no pending state:** guard `if (!st.pendingTurnState) return st` is a no-op.
- **Component unmount before animation finishes:** `onAnimationComplete` ref is closed over; if the component unmounts the callback becomes a stale closure but will simply dispatch to an already-transitioned reducer (which ignores it via the no-pending-state guard).

---

## Files changed

| File | Change |
|------|--------|
| `index.tsx` | GameState type, initialState, `endTurnWithMeterCheck` helper, 8 reducer cases, GameScreen overlay + prop, `METER_ANIMATION_DONE` action type |
| `components/ExcellenceMeter.tsx` | `onAnimationComplete` prop, isFirstMount guard, `playBounce`/`playCelebrate` callbacks |
