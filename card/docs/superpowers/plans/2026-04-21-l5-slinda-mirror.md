# L5.2 Slinda Mirror + Auto-Advance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stuck transition at the end of tutorial step 5.1 and make step 5.2 ("meet Slinda") a mirror of 5.1 — same dice, same prefill, empty sign slot, Slinda centered in the fan.

**Architecture:** Three localized edits. (a) Remove the single-step opt-out in the celebrate auto-advance timer. (b) Extend the existing L5.1 target/lock bus effect to span both step 0 and step 1. (c) Reshape the L5.2 rigging effect so it preserves the L5.1 dice (`4, 3, 9`) and re-pre-fills `d1`/`d2` instead of rolling fresh dice. Plus one stale-pointer fix in the lesson file's `botDemo`.

**Tech Stack:** React Native + TypeScript, existing `tutorialBus` flags (`setL5aTargetResult`, `setL5aBlockFanTaps`), existing `DemoApi` choreography.

**Spec:** `docs/superpowers/specs/2026-04-21-l5-slinda-mirror-design.md`

---

## File map

- **Modify:** `src/tutorial/lessons/lesson-05-op-cycle.ts` — fix `jokerIdx` pointer in the L5.2 `botDemo`; update the top-of-file and step comments to reflect "joker in the middle" + mirrored-exercise pedagogy.
- **Modify:** `src/tutorial/InteractiveTutorialScreen.tsx` — three edits:
  1. Remove the `isL5aCelebrate` early-return in the celebrate timer useEffect (~L1080-1092).
  2. Widen the `setL5aTargetResult` / `setL5aBlockFanTaps` effect predicate from `stepIndex === 0` to `stepIndex <= 1` (~L661-672).
  3. Rewrite the L5.2 rigging block (~L997-1023) to drop `TUTORIAL_SET_DICE` and instead re-emit `eqPickDice(0)` / `eqPickDice(1)` after the hand swap.
- **Create:** `src/tutorial/lessons/lesson-05-op-cycle.test.ts` — new unit test that locks in the middle-index scroll for L5.2's `botDemo` (copies the recording-API pattern from `lesson-01-fan.test.ts`).

No changes to `lesson-registry.test.ts` — existing L5 step assertions still hold (outcome predicates are unchanged).

---

### Task 1: Failing test for L5.2 botDemo middle-index scroll

**Files:**
- Create: `src/tutorial/lessons/lesson-05-op-cycle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import type { DemoApi, ScrollOpts } from '../BotDemonstrator';
import { lesson05OpCycle } from './lesson-05-op-cycle';

type ScrollCall = { idx: number; opts: ScrollOpts };
type PulseCall = { idx: number; durationMs: number | undefined };

function makeRecordingApi(fanLength: number): {
  api: DemoApi;
  scrollCalls: ScrollCall[];
  pulseCalls: PulseCall[];
} {
  const scrollCalls: ScrollCall[] = [];
  const pulseCalls: PulseCall[] = [];
  const api: DemoApi = {
    async scrollFanTo(idx, opts = {}) { scrollCalls.push({ idx, opts }); },
    async pulseCard(idx, durationMs) { pulseCalls.push({ idx, durationMs }); },
    async pulseDiceBtn() {},
    async eqPickDice() {},
    async eqSetOp() {},
    async eqConfirm() {},
    async eqReset() {},
    async stageCardByValue() {},
    l4Config: () => null,
    async wait() {},
    fanLength: () => fanLength,
    async openResultsChip() {},
    async tapMiniResult() {},
    l6CopyConfig: () => null,
  };
  return { api, scrollCalls, pulseCalls };
}

describe('lesson-05 step 2 (joker-place) botDemo', () => {
  it('scrolls to the middle of a 5-card fan (Slinda at index 2)', async () => {
    const { api, scrollCalls, pulseCalls } = makeRecordingApi(5);
    const step = lesson05OpCycle.steps[1];
    await step.botDemo(api);

    expect(scrollCalls.map((c) => c.idx)).toEqual([2]);
    expect(pulseCalls.map((c) => c.idx)).toEqual([2]);
  });

  it('still lands on a valid index for a 4-card fan', async () => {
    // floor(4/2) = 2 → valid (indices 0..3).
    const { api, scrollCalls } = makeRecordingApi(4);
    const step = lesson05OpCycle.steps[1];
    await step.botDemo(api);
    expect(scrollCalls.map((c) => c.idx)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/tutorial/lessons/lesson-05-op-cycle.test.ts`

Expected: FAIL — the assertions check `idx === 2`, but the current code uses `fanLength() - 1`, producing `4` for a 5-card hand and `3` for a 4-card hand.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/tutorial/lessons/lesson-05-op-cycle.test.ts
git commit -m "test(tutorial): lock L5.2 botDemo scroll-to-middle behavior"
```

---

### Task 2: Fix the `jokerIdx` pointer + update comments

**Files:**
- Modify: `src/tutorial/lessons/lesson-05-op-cycle.ts:13-17, 43-53`

- [ ] **Step 1: Update the step's botDemo**

Open `src/tutorial/lessons/lesson-05-op-cycle.ts`. Replace lines 42-58 (the `joker-place` step object) with:

```ts
    {
      id: 'joker-place',
      // Slinda is rigged in the centre of the L5 hand (index 2 of 5 — see
      // InteractiveTutorialScreen's L5.2 rigging block). Scroll there and
      // pulse so the learner's eye lands on her before the bubble prompts
      // them to tap. Using floor(fanLength/2) keeps the pointer correct
      // even if the hand size changes.
      botDemo: async (api) => {
        const jokerIdx = Math.floor(api.fanLength() / 2);
        await api.wait(600);
        await api.scrollFanTo(jokerIdx, { durationMs: 700, easing: 'settle' });
        await api.wait(250);
        await api.pulseCard(jokerIdx, 2200);
      },
      outcome: (event) => event.kind === 'l5JokerFlowCompleted',
      hintKey: 'tutorial.l5b.hintTapJoker',
      botHintKey: 'tutorial.l5b.botIntro',
      celebrateKey: 'tutorial.l5b.celebrate',
    },
```

- [ ] **Step 2: Update the file-header comment**

Replace lines 14-17 (the `Step 5.2 (joker-place): ...` comment block) with:

```ts
// Step 5.2 (joker-place): mirrors the 5.1 exercise exactly —
// dice 4,3,9, d1=4 and d2=3 prefilled, target 7 in the result box,
// sign slot empty — but the player's hand swaps the `+` card for
// Slinda sitting in the centre of the fan. The learner taps Slinda
// → picks a sign in the modal → places her on the empty sign slot.
// The mirrored layout makes the teaching point concrete: same
// puzzle as 5.1, different card.
// ============================================================
```

- [ ] **Step 3: Run the test — expected to pass**

Run: `npx jest src/tutorial/lessons/lesson-05-op-cycle.test.ts`

Expected: PASS — both assertions now see `idx = floor(5/2) = 2` and `floor(4/2) = 2`.

- [ ] **Step 4: Run the broader lesson tests to confirm no regressions**

Run: `npx jest src/tutorial/lessons/`

Expected: PASS across `lesson-01-fan.test.ts`, `lesson-05-op-cycle.test.ts`, `lesson-registry.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/tutorial/lessons/lesson-05-op-cycle.ts
git commit -m "fix(tutorial): L5.2 botDemo scrolls to Slinda at fan centre"
```

---

### Task 3: Remove the L5.1 celebrate auto-advance opt-out

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx:1076-1092`

- [ ] **Step 1: Locate the celebrate timer effect**

Read lines 1076-1092 to confirm the current body matches this (the guard at lines 1083-1087 is what we're removing):

```ts
  // ── Celebrate timer (longer if the step provides a custom message
  //    that the learner actually needs time to read). Dice lesson (idx 2)
  //    skips straight to the equation with zero delay. ──
  useEffect(() => {
    if (engine.phase !== 'celebrate') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    // Lesson 5 step 5a (sign cycle): no auto-advance — learner reads the
    // celebrate line and taps "הבנתי" to move on. Matches presentation-style
    // pacing (manual advance, no auto-play).
    const isL5aCelebrate = engine.lessonIndex === 4 && engine.stepIndex === 0;
    if (isL5aCelebrate) return;
    // Dice lesson → equation: instant transition, no celebration pause.
    const ms = step?.celebrateKey ? 2600 : CELEBRATE_MS;
    const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), ms);
    return () => clearTimeout(id);
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);
```

- [ ] **Step 2: Remove the guard lines**

Edit the effect body to drop the L5a-specific early return and its comment. The resulting effect should read:

```ts
  // ── Celebrate timer (longer if the step provides a custom message
  //    that the learner actually needs time to read). Dice lesson (idx 2)
  //    skips straight to the equation with zero delay. ──
  useEffect(() => {
    if (engine.phase !== 'celebrate') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    // Dice lesson → equation: instant transition, no celebration pause.
    const ms = step?.celebrateKey ? 2600 : CELEBRATE_MS;
    const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), ms);
    return () => clearTimeout(id);
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` (or the project's typecheck command)

Expected: no new TypeScript errors introduced by this change.

- [ ] **Step 4: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "fix(tutorial): auto-advance L5.1 celebrate like every other step"
```

---

### Task 4: Extend the target/lock effect to cover L5.2

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx:654-672`

- [ ] **Step 1: Locate the effect**

The current effect gates on `stepIndex === 0`:

```ts
  // L5.1 (place-op) ONLY: lock the pre-filled dice slots so the learner
  // can't accidentally empty the equation while searching for the operator
  // slot. `setL5aBlockFanTaps` drives that lock in renderDiceSlot /
  // unplaced-dice-button onPress. Leaves fan card taps untouched — the
  // learner still needs to pick an operation card from the fan.
  // `setL5aTargetResult` pushes the target (7 for `4 + 3`) into the result
  // box so the learner sees what they're aiming for before picking an op.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      engine.stepIndex === 0 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    tutorialBus.setL5aBlockFanTaps(on);
    tutorialBus.setL5aTargetResult(on ? 7 : null);
    return () => {
      tutorialBus.setL5aBlockFanTaps(false);
      tutorialBus.setL5aTargetResult(null);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);
```

- [ ] **Step 2: Widen to both steps**

Change `stepIndex === 0` to `stepIndex <= 1` and refresh the comment so the "L5.1 ONLY" claim is no longer misleading:

```ts
  // L5.1 (place-op) AND L5.2 (joker-place): lock the pre-filled dice slots
  // so the learner can't accidentally empty the equation while searching
  // for the operator slot. `setL5aBlockFanTaps` drives that lock in
  // renderDiceSlot / unplaced-dice-button onPress. Leaves fan card taps
  // untouched — the learner still needs to pick an operation card (or
  // Slinda) from the fan.
  // `setL5aTargetResult` pushes the target (7 for `4 + 3`) into the result
  // box so both steps show the same goal: sign slot empty, target `= 7`.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      engine.stepIndex <= 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    tutorialBus.setL5aBlockFanTaps(on);
    tutorialBus.setL5aTargetResult(on ? 7 : null);
    return () => {
      tutorialBus.setL5aBlockFanTaps(false);
      tutorialBus.setL5aTargetResult(null);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "fix(tutorial): pin target 7 + lock dice through L5.2 so Slinda step mirrors 5.1"
```

---

### Task 5: Rewrite the L5.2 rigging block to preserve L5.1 dice

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx:985-1025`

- [ ] **Step 1: Locate the rigging block**

The current block rolls fresh dice (`4, 8, 2`) and installs the 5-card hand:

```ts
  // ── Between lesson-5 steps (place-op → joker), reset per-step state so
  //    each step starts on a clean slate (modal closed, no pending joker
  //    pick). Step 0 (place-op) rigging — full 3-dice layout with `+` on
  //    both operator slots — lives in the lesson-entry rigging block (see
  //    the L5 dice/hand useEffect above). ──
  useEffect(() => {
    if (engine.lessonIndex !== 4) return;
    if (engine.phase !== 'bot-demo') return;
    if (engine.stepIndex > 0) {
      setL5JokerOpen(false);
      setL5PendingJokerOp(null);
    }
    if (engine.stepIndex === 1) {
      // Step 5.2 (joker-place — "meet Slinda"): fresh roll + rearrange the
      // hand so the joker sits in the centre of the fan. First clear any
      // leftover equation state from 5.1 (dice slots, placed operator
      // card, op1/op2 cycle), then swap in new dice values and re-rig the
      // hand with the joker at index 2.
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      const L5B_DICE = { d1: 4, d2: 8, d3: 2 };
      gameDispatch({ type: 'TUTORIAL_SET_DICE', values: { die1: L5B_DICE.d1, die2: L5B_DICE.d2, die3: L5B_DICE.d3 } });
      const ts = Date.now();
      const playerHand = [
        { id: `tut-l5b-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      const botHand = [
        { id: `tut-l5b-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-bot-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-bot-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-bot-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);
```

- [ ] **Step 2: Rewrite the block**

Drop `TUTORIAL_SET_DICE` (we keep the 5.1 dice `4, 3, 9` on-screen) and add the staged `eqPickDice` re-pre-fill pattern that `rigL5OpPickExercise` uses (140ms then 280ms after the hand swap):

```ts
  // ── Between lesson-5 steps (place-op → joker), reset per-step state so
  //    each step starts on a clean slate (modal closed, no pending joker
  //    pick). Step 0 (place-op) rigging — full 3-dice layout with `+` on
  //    both operator slots — lives in the lesson-entry rigging block (see
  //    the L5 dice/hand useEffect above). ──
  useEffect(() => {
    if (engine.lessonIndex !== 4) return;
    if (engine.phase !== 'bot-demo') return;
    if (engine.stepIndex > 0) {
      setL5JokerOpen(false);
      setL5PendingJokerOp(null);
    }
    if (engine.stepIndex === 1) {
      // Step 5.2 (joker-place — "meet Slinda"): mirror 5.1. Keep the 5.1
      // dice (4, 3, 9) on the table; clear the placed `+` card and the
      // op/result state; swap in a 5-card hand with Slinda centred at
      // index 2; then re-pre-fill d1 and d2 so the equation reads
      // `4 ? 3 = 7` with the sign slot empty. The staged delays mirror
      // `rigL5OpPickExercise`'s pattern — without them, eqPickDice races
      // the eqReset commit.
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      const ts = Date.now();
      const playerHand = [
        { id: `tut-l5b-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      const botHand = [
        { id: `tut-l5b-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-bot-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-bot-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-bot-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Run the tutorial test suite**

Run: `npx jest src/tutorial/`

Expected: all existing tutorial tests pass; `lesson-05-op-cycle.test.ts` from Task 1 still passes.

- [ ] **Step 5: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "fix(tutorial): L5.2 mirrors 5.1 — same dice, same prefill, empty sign slot"
```

---

### Task 6: Manual verification

No unit test can cover the full user-visible flow (it spans React Native rendering, the tutorialBus, the EquationBuilder, and the lesson engine). Verify by running the app.

- [ ] **Step 1: Start the app**

Run the project's dev command (e.g. `npx expo start` or the equivalent). Open the tutorial.

- [ ] **Step 2: Walk to lesson 5 step 1 and confirm**

Advance through lessons 1-4 normally. In L5.1 you should see dice `4 3 9`, equation `4 ? 3 = 7`, hand of 4 operator cards.

- [ ] **Step 3: Complete L5.1 and watch for auto-advance**

Place the `+` card on the `?` slot. The celebrate bubble ("נמשיך לסלינדה") should appear, then the screen should transition to L5.2 automatically after ~2.6 seconds — no button press required.

- [ ] **Step 4: Confirm L5.2 mirror**

On L5.2 entry verify:
- Dice still show `4 3 9` (no re-roll animation to different numbers).
- Equation shows `4 ? 3 = 7` with the sign slot empty.
- Hand is `[+, -, Slinda, x, ÷]` with Slinda in the visual centre of the fan.
- Bot demo scrolls to and pulses Slinda (middle card), not the `÷` card.

- [ ] **Step 5: Complete L5.2**

Tap Slinda → pick any sign in the modal → tap the empty `?` slot → celebrate → auto-advance to L6 (the possible-results chip lesson).

- [ ] **Step 6: Regression spot-check**

Walk back (use `‹ חזור`) from L6 → L5.2 → L5.1 → L5.2 to confirm re-entry still rigs each step correctly (dice stay `4 3 9` across both steps, L5.2 hand re-adds Slinda at index 2, target `7` stays pinned in the result box).

- [ ] **Step 7: If all steps pass, no commit needed** — the previous task commits cover the change.

---

## Self-review checklist (already run by the author)

- **Spec coverage:**
  - Auto-advance fix → Task 3. ✓
  - L5.2 mirror (same dice + prefill + empty sign slot) → Tasks 4 + 5. ✓
  - Slinda-at-centre fan pointer fix → Tasks 1 + 2. ✓
  - No L6 / lesson registry changes — spec confirms out-of-scope. ✓
- **Placeholders:** none.
- **Type consistency:** all `tutorialBus` setter names and event kinds (`eqReset`, `eqPickDice`, `setL5aTargetResult`, `setL5aBlockFanTaps`) match their existing signatures in `tutorialBus.ts`. `gameDispatch` action types (`CLEAR_EQ_HAND`, `TUTORIAL_SET_HANDS`) match what the block already used.
- **Scope:** single tutorial lesson, three edit sites + one new test file — within a single plan.
