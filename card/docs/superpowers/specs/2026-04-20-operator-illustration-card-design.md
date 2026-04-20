# Operator Illustration Card — Tutorial Lesson 5a

**Date:** 2026-04-20
**Scope:** Tutorial lesson 5, step `cycle-signs` (5a)
**Goal:** Cognitively link the operator symbol shown in the equation with the real game card the learner will play with later.

## Summary

During tutorial lesson 5 step 5a (`cycle-signs`), display the real game `OperationCard` component — positioned at the learner's normal fan (hand) vertical position — mirroring whatever operator is currently selected in the equation's `?` slot. The learner's real hand is hidden during step 5a, and reappears in step 5b (joker flow) where the joker card becomes interactive.

No new mockup visuals. No duplication of the `OperationCard` styling. The tutorial uses the game's existing component as-is so the learner immediately recognizes the card when they encounter it in the real game.

## Non-goals

- No change to the equation cycling logic (`index.tsx:cycleOp`).
- No change to lesson 5 step outcome predicates (`l5AllSignsCycled`, `l5JokerFlowCompleted`).
- No change to the existing `l5SlotPulse` animation on the equation's operator slot.
- No new tutorial bus events.
- No resurrection of the legacy `L5OpCard` / `L5Operand` / `L5JokerCard` scratch helpers. Those remain unused and should be removed as part of this work (cleanup).

## Component reuse

**Rendered component:** `OperationCard` from `src/components/cards/OperationCard.tsx` — unchanged.

**Wrapping:** `OperationCard` with `small={false}` (default) renders the underlying `Card` at 72×104. To reach the ≥120px spec, wrap in an `Animated.View` with `transform: [{ scale: 1.25 }]` → effective 90×130. No CSS/style edits to `OperationCard` or `Card` themselves.

**Card data shape:**

```ts
{ id: 'tut-l5-show-op', type: 'operation', operation: l5SelectedOp }
```

`L5Op = '+' | '-' | 'x' | '÷'` is identical to the game's `Operation` type — pass through directly. (An earlier draft of this spec called for mapping `'x' → '*'` and `'÷' → '/'`, but the real game's `OperationCard` renders `card.operation` as a literal string, so those glyphs would have drifted from what the learner sees in the equation's `?` slot and in real game cards.)

## State wiring

**Source of truth:** `l5SelectedOp` — already present in `InteractiveTutorialScreen.tsx:299`. Already updated by `index.tsx:cycleOp` via the existing tutorial bus → reducer path. No new state.

**Rendering rule:**

- If `l5SelectedOp === null` (before first tap): the illustration card is **not** rendered. The fan-area behind it is still covered (see Fan handling). This leaves an inviting empty space that draws attention back to the pulsing `?` slot in the equation.
- If `l5SelectedOp !== null`: render the `OperationCard` populated with that operator.

**Condition for the whole feature to be active:**

```ts
const showOpIllustration =
  engine.lessonIndex === 4 /* op-cycle */ &&
  engine.stepIndex === 0 /* cycle-signs */ &&
  (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
```

The illustration stays visible during `celebrate` so the learner sees the last-chosen operator linger for a beat as the step resolves.

## Layout & sizing

- **Position:** `position: 'absolute'`, horizontally centered (`left: 0, right: 0, alignItems: 'center'`).
- **Vertical anchor:** Centered inside the fan strip band. Using the existing constants (`FAN_BOTTOM = 195`, `FAN_STRIP_H = 140`), compute `bottom: FAN_BOTTOM + (FAN_STRIP_H - 130) / 2 ≈ 200`. In practice: `bottom: 200`.
- **Size:** rendered height 130px (`Card` 104px × scale 1.25), width 90px.
- **z-index:** 9100 — above the cover layer (9050), below the speech bubble (9200) and exit/skip controls (9600).

## Fan handling during step 5a

**Problem:** Lesson 5's rigged hand (joker + 4 numbers) is present from the start of the lesson because step 5b needs the joker card to be tappable. Without intervention, the real fan is visible behind/beside our illustration card.

**Solution:** An opaque cover view, same background as the game screen (`#0a1628`).

- `position: 'absolute'`, full width (`left: 0, right: 0`).
- Vertical: `bottom: 0, height: FAN_VISUAL_TOP_FROM_BOTTOM` (= 365) — covers the entire fan band including the card bleed margin (`FAN_BOTTOM 195 + FAN_STRIP_H 140 + 30` margin).
- `z-index: 9050`.
- `pointerEvents: 'auto'` — catches accidental taps so the learner cannot interact with the hidden fan.
- Active only when `showOpIllustration` evaluates true (see State wiring).

**Transition to step 5b:** When `engine.stepIndex` flips to 1, `showOpIllustration` becomes false, the cover and the illustration card both unmount, and the real fan (with the joker card) becomes visible and interactive. No manual animation required — unmount is instantaneous, which matches the lesson's step transition feel.

## Animations

### Pulse on the operator slot in the equation

Unchanged. The existing `l5SlotPulse` (InteractiveTutorialScreen.tsx:305, driven 857–869) already pulses the `?` slot while `l5SelectedOp === null`.

### Card swap animation (when operator cycles)

When `l5SelectedOp` changes between non-null values, the card animates a brief "flip" to emphasize the change:

- A single `Animated.Value` named `cardAnim` driven by a `useEffect` on `[l5SelectedOp]`.
- Sequence: `Animated.sequence([ timing(cardAnim, { toValue: 0, duration: 120 }), timing(cardAnim, { toValue: 1, duration: 180 }) ])`.
- `cardAnim` drives both `opacity` (interpolated 0 → 1, full range) and `transform.scale` (interpolated to `[0.85, 1.25]` so the resting scale stays at the 1.25 target).
- Uses `useNativeDriver: true` — `opacity` and `transform.scale` are both native-driver-safe.

### First appearance

When `l5SelectedOp` transitions from `null` to its first non-null value, the card mounts and `cardAnim` starts at 0 → animates to 1 (180ms via `timing`, no preceding down-leg since it's already at 0). This yields a gentle scale/fade-in entrance rather than a hard pop-in.

## Copy (i18n)

No new strings. The existing `tutorial.l5a.hintCycle`, `tutorial.l5a.botIntro`, `tutorial.l5a.celebrate` keys cover the speech bubbles. The illustration card shows the operator symbol itself — no text label needed beyond what `OperationCard` already renders internally (the small "פעולה" / "Operation" label below the symbol).

## Files touched

- `src/tutorial/InteractiveTutorialScreen.tsx` — add the illustration card render, the cover view, and the swap animation.
- Remove (cleanup): the unused `L5Operand`, `L5OpCard`, `L5JokerCard` local helpers (~lines 1435–1466). No external consumers — grep confirmed they are referenced nowhere.

No changes to:

- `src/components/cards/OperationCard.tsx`
- `src/tutorial/lessons/lesson-05-op-cycle.ts`
- `src/tutorial/tutorialBus.ts`
- `src/tutorial/MimicEngine.ts`
- `index.tsx`
- `shared/i18n/*.ts`

## Testing

### Manual

1. Start tutorial → advance to lesson 5 intro → enter step 5a.
2. Verify: equation shows two numbers and a pulsing `?` slot; fan area is blank (no joker, no number cards visible); no illustration card yet.
3. Tap the `?` slot once. Verify: slot shows `+`, illustration card appears at fan position with the same `+` operator (orange/cream `OperationCard` styling). Card height ≥120px.
4. Tap again → card flips to `−`. Then `×`. Then `÷`. Each transition plays the short fade/scale swap.
5. After all 4 have been shown (any order), step advances to 5b.
6. Verify: illustration card and cover disappear; real fan becomes visible with the joker card; step 5b speech bubble appears.

### Automated

The existing `lesson-registry.test.ts` and `mimicFractionBranch.test.ts` continue to pass unchanged. Optional: add one snapshot test that the illustration card mounts only when `(lessonIndex === 4 && stepIndex === 0 && l5SelectedOp !== null)`. Not required for correctness — the render condition is small and obvious.

## Open questions

None — all scope and behavior decisions were resolved during brainstorming.
