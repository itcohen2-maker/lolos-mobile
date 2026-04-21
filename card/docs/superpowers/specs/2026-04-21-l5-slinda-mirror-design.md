# L5.2 "Meet Slinda" — mirror L5.1 + fix auto-advance

Date: 2026-04-21
Scope: `src/tutorial/lessons/lesson-05-op-cycle.ts`, `src/tutorial/InteractiveTutorialScreen.tsx`

## Problem

Two linked issues at the end of tutorial lesson 5:

1. **L5.1 does not auto-advance.** After the learner places `+` on the `?` slot, the celebrate bubble reads *"יופי — הנחתם קלף פעולה בתרגיל. נמשיך לסלינדה"* but the screen stays on 5.1. The learner expects a transition and gets none. The only way forward is the tiny `הבנתי ›` button in the top-right, which reads as a skip/debug control and is easy to miss. Every other celebrate step in the tutorial auto-advances after 2.6s; L5.1 has an explicit opt-out (`isL5aCelebrate` guard in the celebrate timer).

2. **L5.2 ("meet Slinda") does not mirror L5.1.** The step currently rolls fresh dice (4, 8, 2) and clears the equation, so the learner is dropped into a blank screen they have to build from scratch. The lesson's teaching goal is "you already know how to place an operation sign — now do the exact same thing, but with Slinda instead of `+`". The screen should re-use the 5.1 exercise (`4 ? 3 = 7`) with the sign slot empty so the contrast is clear: same puzzle, different card.

3. **Minor: stale `botDemo` pointer.** `lesson-05-op-cycle.ts:48` scrolls the fan to `fanLength - 1` (last card = `÷`) based on an outdated comment that assumed the joker sits at the end of the hand. The actual L5.2 rigging places Slinda at index 2 (middle of 5 cards). The bot demo therefore scrolls past Slinda onto the wrong card.

## Goals

- L5.1 celebrate advances to L5.2 automatically after ~2.6s (same pacing as every other step with a celebrate message).
- L5.2 renders the same exercise as L5.1: dice `4, 3, 9`, `d1=4`/`d2=3` prefilled in the equation, target `7` displayed in the result box, sign slot empty.
- The learner's hand in L5.2 is `[+, -, Slinda, x, ÷]` — Slinda at index 2, which is the visual center of a 5-card fan.
- Tapping Slinda → modal → pick sign → place on the empty slot → `l5JokerFlowCompleted` → celebrate → auto-advance to L6 (possible results).

## Non-goals

- No change to L5.1 mechanics (exercise, hand, pre-fill, outcome event).
- No change to L6 (possible results) or the lesson registry.
- No new i18n keys — the existing `tutorial.l5a.celebrate` / `tutorial.l5b.*` lines already match the new flow.

## Design

### 1. Auto-advance fix

In `InteractiveTutorialScreen.tsx` the celebrate timer effect currently guards L5.1:

```ts
const isL5aCelebrate = engine.lessonIndex === 4 && engine.stepIndex === 0;
if (isL5aCelebrate) return;
```

Remove those two lines. The effect falls through to the standard 2.6s timer for steps with a `celebrateKey` (L5.1 has one), matching every other celebrate in the tutorial.

### 2. Mirror L5.1 exercise in L5.2

L5.1's state already sets up the exact scene we want: dice `4, 3, 9`, hand of four op cards, `d1`/`d2` prefilled, target `7` shown in the result via `tutorialBus.setL5aTargetResult(7)`, dice slots locked via `setL5aBlockFanTaps(true)`.

Two changes to `InteractiveTutorialScreen.tsx`:

**2a. Extend the target/lock effect to cover L5.2.** Today the `setL5aTargetResult` / `setL5aBlockFanTaps` effect only activates on `stepIndex === 0`. Change the predicate so it's active for both steps (0 and 1). The name `L5a*` is legacy; these flags lock the dice prefill and push `7` into the result box, which is exactly what 5.2 needs too.

**2b. Reshape the L5.2 rigging effect.** The block at `~997-1023` currently calls `CLEAR_EQ_HAND`, emits `eqReset`, then issues `TUTORIAL_SET_DICE` with `4, 8, 2` and installs the 5-card hand. Replace this with:

1. `CLEAR_EQ_HAND` + `emitFanDemo({ kind: 'eqReset' })` — clears the `+` the learner placed in 5.1 and resets the op/result state.
2. Do **not** call `TUTORIAL_SET_DICE` — the dice from 5.1 (`4, 3, 9`) are already on-screen and that's what we want.
3. Install the 5-card hand `[+, -, Slinda, x, ÷]` (same 5 cards as today, same order — Slinda stays at index 2).
4. Re-emit `eqPickDice` for idx 0 then idx 1 on a 140/280ms delay (same pattern as `rigL5OpPickExercise` at line 377-378) so `d1` and `d2` snap back after React commits the hand swap. `eqReset` clears the dice slots alongside the op, so we have to re-pre-fill them.

Target `7` comes "for free" because the extended effect in 2a keeps `setL5aTargetResult(7)` active across both steps.

### 3. Fix the Slinda scroll pointer

In `lesson-05-op-cycle.ts`:

```ts
const jokerIdx = Math.max(0, api.fanLength() - 1);
```

becomes:

```ts
const jokerIdx = Math.floor(api.fanLength() / 2);
```

This lands on index 2 for a 5-card hand — the actual Slinda position. Update the comment at the top of the step block ("Joker is rigged as the LAST card…") to reflect the new center-of-fan layout. Also update the file-header comment at line 16 ("Slinda the joker is centred in the fan for this step.") to explicitly call out the mirrored-exercise pedagogy.

## Data flow

```
L5.1 await-mimic
  learner drags `+` onto the `?` slot
  → PLACE_EQ_OP → emits l5OperatorPlaced { op: '+' }
  → engine: await-mimic → celebrate ("נמשיך לסלינדה")
  → (after 2.6s) CELEBRATE_DONE
  → engine: celebrate → bot-demo, stepIndex=1

L5.2 bot-demo (rigging effect fires)
  CLEAR_EQ_HAND + eqReset
  TUTORIAL_SET_HANDS → [+, -, Slinda, x, ÷]
  eqPickDice(0) at +140ms → d1 = 4
  eqPickDice(1) at +280ms → d2 = 3
  target 7 already pinned in result box by the L5.1/5.2 effect
  botDemo: scrollFanTo(floor(fanLength/2)=2) → pulse Slinda

L5.2 await-mimic
  learner taps Slinda → modal opens (emit l5JokerModalOpened)
  picks a sign → modal closes (emit l5JokerPickedInModal)
  taps empty `?` slot → PLACE_EQ_OP → emits l5JokerFlowCompleted { op }
  → engine: await-mimic → celebrate ("כל הכבוד — הכרתם את סלינדה")
  → (after 2.6s) CELEBRATE_DONE → celebrate → lesson-done
  → DISMISS_LESSON_DONE (auto? manual? — unchanged from today)
  → engine: lesson-done → intro, lessonIndex=5 (possible-results)
```

## Risks & edge cases

- **Dice re-pre-fill race.** `eqReset` asynchronously clears the slots. If `eqPickDice(0)` fires before the reset commits, the pick can be overwritten. The existing `rigL5OpPickExercise` solves this with a 140ms then 280ms delay; we use the same numbers. If the race re-appears in practice, bump both delays.
- **GO_BACK from L6 into L5.2.** The back button returns to the previous step's `intro`. The L5.2 rigging effect already keys off `engine.phase === 'bot-demo'` so it re-runs on re-entry. Because we now preserve the 5.1 dice, a GO_BACK from L5.2 → L5.1 needs L5.1's own rigging effect to reset `l5LessonHandRiggedRef` and re-install the 4-card hand. That ref is cleared on `phase === 'intro'` (line 885-889), so GO_BACK through intro works. GO_BACK without passing through intro (unlikely — the reducer always returns to `intro`) would need manual retesting; noting as a known edge.
- **Target 7 visible in L5.2 celebrate.** The extended effect keeps `setL5aTargetResult(7)` on through the celebrate phase of L5.2. Since the op is placed by then, the result box shows the real computed result (`= 7`, assuming the learner picked `+`), not the pinned target — `hasL5aTarget` is gated on `finalResult === null`. Safe.

## Out of scope

- Redesigning the `הבנתי ›` / `דלג ›` button pair — they stay as-is (useful for QA skipping). The auto-advance fix makes them optional for normal play.
- Changing L5.1's dice/target/hand. The user explicitly wants "exactly like the previous step" in 5.2.

## Acceptance

1. Place `+` in 5.1 → within ~3 seconds the screen transitions to 5.2 with no user interaction.
2. 5.2 opens with dice `4 3 9`, equation showing `4 ? 3 = 7`, sign slot empty, hand `[+, -, Slinda, x, ÷]`, Slinda centered visually.
3. Bot-demo phase of 5.2 scrolls to and pulses Slinda (index 2), not the `÷` card.
4. Tap Slinda → pick a sign → place → celebrate → auto-advance to L6 (possible results).
