# L4 Empty Start + L9 Full-Turn Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Fix lesson 4 full-build step to start with an empty equation. (2) Redesign lesson 9 (identical card) into a full game-turn simulation: dice roll → results strip auto-opens → mini card selection unlocks equation building → confirm equation → pick card → "בחרתי".

**Architecture:** All logic lives in `InteractiveTutorialScreen.tsx`. New `l9Stage (0|1|2)` state drives the staged interaction model. An overlay blocks the equation area during stage 0. Fan taps stay blocked until stage 2 via existing `setL5aBlockFanTaps`. `L4Step3Mode` (reused) enables the "אשר" + "בחרתי" buttons at stage 2. Lesson outcome changes to `userPlayedCards`.

**Tech Stack:** React Native, tutorialBus, MimicEngine (dispatchEngine), game reducer.

---

## Background

### L4 equation pre-filled bug
- Lesson 4 step 3 (`id: 'full-build'`, `stepIndex=2`) bot-demo calls `eqReset()` then just scrolls the fan. However, by the time `await-mimic` starts, the equation builder shows values from the previous step.
- Fix: emit `eqReset` when the `L4Step3` effect activates for `await-mimic`.

### L9 redesign
- **Current**: mini strip open, user taps mini card, copies 2-number equation, confirms → `l6CopyConfirmed` → advance.
- **New**: simulate a real turn — dice roll animation, results strip auto-opens. User must select mini card first (overlay blocks equation area). After selection, solve chip shows target. User builds full equation (picks two dice + op), confirms, picks a card from fan, taps "בחרתי" → `userPlayedCards` → advance.
- **Key dependency**: `userPlayedCards` is emitted in `index.tsx` only when `tutorialBus.getL4Step3Mode()` is true. We enable `L4Step3Mode` when `l9Stage === 2`.

### l9Stage values
| Stage | Trigger | What's allowed |
|-------|---------|----------------|
| 0 | entering await-mimic | only mini card taps |
| 1 | miniCardTapped | equation builder + op slot |
| 2 | l6CopyConfirmed | fan card selection + "בחרתי" |

---

## File Map

| File | Change |
|------|--------|
| `src/tutorial/InteractiveTutorialScreen.tsx` | All logic |
| `src/tutorial/lessons/lesson-08-identical.ts` | Outcome → `userPlayedCards` |
| `shared/i18n/he.ts` | New key `tutorial.l9.selectMini` |
| `shared/i18n/en.ts` | New key `tutorial.l9.selectMini` |

---

## Task 1 — Fix L4 full-build equation arrives empty

**File:** `src/tutorial/InteractiveTutorialScreen.tsx` lines ~878-886

- [ ] **Step 1: Add eqReset to L4Step3 await-mimic entry**

Find the effect at line ~878:
```typescript
useEffect(() => {
  const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  if (isL4Step3) {
    tutorialBus.setL4Step3Mode(true);
    setL4Step3Phase('build');
    return () => tutorialBus.setL4Step3Mode(false);
  }
  tutorialBus.setL4Step3Mode(false);
}, [engine.lessonIndex, engine.stepIndex, engine.phase]);
```

Replace with:
```typescript
useEffect(() => {
  const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  if (isL4Step3) {
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    tutorialBus.setL4Step3Mode(true);
    setL4Step3Phase('build');
    return () => tutorialBus.setL4Step3Mode(false);
  }
  tutorialBus.setL4Step3Mode(false);
}, [engine.lessonIndex, engine.stepIndex, engine.phase]);
```

- [ ] **Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | grep InteractiveTutorialScreen
```
Expected: no output.

---

## Task 2 — Add l9Stage state + i18n key

**Files:** `InteractiveTutorialScreen.tsx`, `shared/i18n/he.ts`, `shared/i18n/en.ts`

- [ ] **Step 1: Add l9Stage state**

Near the other L9 state (`l9Mismatch`, line ~465), add:
```typescript
const [l9Stage, setL9Stage] = useState<0 | 1 | 2>(0);
```

- [ ] **Step 2: Add Hebrew i18n key**

In `shared/i18n/he.ts`, after `'tutorial.l9.copy.mismatch'`:
```typescript
'tutorial.l9.selectMini': 'בחר מיני קלף והעתק את התרגיל למשוואה',
```

- [ ] **Step 3: Add English i18n key**

In `shared/i18n/en.ts`, in the same location:
```typescript
'tutorial.l9.selectMini': 'Select a mini card and copy the equation',
```

---

## Task 3 — Change L9 lesson outcome to userPlayedCards

**File:** `src/tutorial/lessons/lesson-08-identical.ts`

- [ ] **Step 1: Update outcome**

Replace:
```typescript
outcome: (e) => e.kind === 'l6CopyConfirmed',
```
With:
```typescript
outcome: (e) => e.kind === 'userPlayedCards',
```

---

## Task 4 — Modify L9 rigging to simulate new turn

**File:** `src/tutorial/InteractiveTutorialScreen.tsx` — the `l9RiggedRef` effect (lines ~1599-1613)

Current rigging:
```typescript
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) { l9RiggedRef.current = false; return; }
  if (engine.phase !== 'bot-demo') { l9RiggedRef.current = false; return; }
  if (engine.stepIndex !== 0) return;
  if (l9RiggedRef.current) return;
  l9RiggedRef.current = true;
  gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
  gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
  gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
  tutorialBus.setL6CopyConfig(null);
  tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
  tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
  tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
  tutorialBus.emitFanDemo({ kind: 'eqReset' });
}, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);
```

- [ ] **Step 1: Add ROLL_DICE and stage reset**

Replace the rigging effect with:
```typescript
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) { l9RiggedRef.current = false; return; }
  if (engine.phase !== 'bot-demo') { l9RiggedRef.current = false; return; }
  if (engine.stepIndex !== 0) return;
  if (l9RiggedRef.current) return;
  l9RiggedRef.current = true;
  setL9Stage(0);
  gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
  gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
  gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
  tutorialBus.setL6CopyConfig(null);
  tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
  tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
  tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
  tutorialBus.emitFanDemo({ kind: 'eqReset' });
  // Trigger visible dice-roll animation
  gameDispatch({ type: 'ROLL_DICE', values: { die1: 6, die2: 2, die3: 1 } });
}, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);
```

---

## Task 5 — L9 stage management effects

**File:** `src/tutorial/InteractiveTutorialScreen.tsx`

Add these four effects after the `l9RiggedRef` effect (around line 1615):

- [ ] **Step 1: Reset l9Stage on leave / back-nav**

```typescript
// ── L9: reset stage when leaving the lesson or re-entering bot-demo ──
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) { setL9Stage(0); return; }
  if (engine.phase === 'bot-demo' || engine.phase === 'intro') setL9Stage(0);
}, [engine.lessonIndex, engine.phase]);
```

- [ ] **Step 2: Stage 0→1 on mini card tap**

```typescript
// ── L9 stage 0→1: mini card tapped → unlock equation builder ──
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.phase !== 'await-mimic' || l9Stage !== 0) return;
  return tutorialBus.subscribeUserEvent((e) => {
    if (e.kind === 'miniCardTapped') setL9Stage(1);
  });
}, [engine.lessonIndex, engine.phase, l9Stage]);
```

- [ ] **Step 3: Stage 1→2 on equation confirmed**

```typescript
// ── L9 stage 1→2: equation confirmed correctly → unlock fan for card play ──
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.phase !== 'await-mimic' || l9Stage !== 1) return;
  return tutorialBus.subscribeUserEvent((e) => {
    if (e.kind === 'l6CopyConfirmed') setL9Stage(2);
  });
}, [engine.lessonIndex, engine.phase, l9Stage]);
```

- [ ] **Step 4: Enable L4Step3Mode at stage 2 (makes "בחרתי" functional)**

```typescript
// ── L9 stage 2: enable L4Step3Mode so the "בחרתי" button emits userPlayedCards ──
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.phase !== 'await-mimic' || l9Stage !== 2) return;
  tutorialBus.setL4Step3Mode(true);
  return () => tutorialBus.setL4Step3Mode(false);
}, [engine.lessonIndex, engine.phase, l9Stage]);
```

- [ ] **Step 5: Fan blocking — locked at stages 0+1, open at stage 2**

```typescript
// ── L9 fan block: stages 0+1 block fan; stage 2 unblocks for card selection ──
useEffect(() => {
  if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.phase !== 'await-mimic') {
    return;
  }
  tutorialBus.setL5aBlockFanTaps(l9Stage < 2);
  return () => tutorialBus.setL5aBlockFanTaps(false);
}, [engine.lessonIndex, engine.phase, l9Stage]);
```

---

## Task 6 — Stage-0 blocking overlay (equation area)

**File:** `src/tutorial/InteractiveTutorialScreen.tsx` — JSX render section

- [ ] **Step 1: Add blocking overlay**

Find where the fractions lesson or parens lesson overlay blocks are rendered (around line 2950+). Add BEFORE the Core tutorial finished section:

```tsx
{/* L9 stage 0: block equation builder area, only mini card strip is interactive */}
{engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX &&
 engine.phase === 'await-mimic' && l9Stage === 0 ? (
  <View
    pointerEvents="auto"
    style={{
      position: 'absolute',
      top: 160,
      left: 0,
      right: 0,
      bottom: FAN_VISUAL_TOP_FROM_BOTTOM,
      backgroundColor: 'transparent',
      zIndex: 9100,
    }}
  />
) : null}
```

---

## Task 7 — Update bubbleText for L9

**File:** `src/tutorial/InteractiveTutorialScreen.tsx` — bubbleText computation (lines ~1970-1985)

- [ ] **Step 1: Add l9 stage-0 bubble key const**

Near the `l9MismatchHintKey` const (line ~1942), add:
```typescript
const l9SelectMiniKey: string | null =
  engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX &&
  engine.phase === 'await-mimic' &&
  l9Stage === 0
    ? 'tutorial.l9.selectMini'
    : null;
```

- [ ] **Step 2: Suppress currentStep hintKey for L9 + wire new key**

Find the `bubbleText` await-mimic line (~line 1977):
```typescript
: engine.phase === 'await-mimic'
  ? (l9MismatchHintKey ? t(l9MismatchHintKey) : l4Step3HintKey ? t(l4Step3HintKey) : l5PlaceHintKey ? t(l5PlaceHintKey, l5PlaceHintParams) : l5bHintKey ? t(l5bHintKey) : l6MismatchHintKey ? t(l6MismatchHintKey) : l7MismatchHintKey ? t(l7MismatchHintKey) : (currentStep?.hintKey ? t(currentStep.hintKey) : null))
```

Replace with:
```typescript
: engine.phase === 'await-mimic'
  ? (l9SelectMiniKey ? t(l9SelectMiniKey) : l9MismatchHintKey ? t(l9MismatchHintKey) : l4Step3HintKey ? t(l4Step3HintKey) : l5PlaceHintKey ? t(l5PlaceHintKey, l5PlaceHintParams) : l5bHintKey ? t(l5bHintKey) : l6MismatchHintKey ? t(l6MismatchHintKey) : l7MismatchHintKey ? t(l7MismatchHintKey) : (engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX ? null : (currentStep?.hintKey ? t(currentStep.hintKey) : null)))
```

This:
- Stage 0: shows "בחר מיני קלף..." 
- Stage 1+2: shows mismatch only (suppresses `currentStep.hintKey` for L9)

---

## Task 8 — Verify TypeScript and smoke-test

- [ ] **Step 1: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep -E "InteractiveTutorialScreen|lesson-08|he\.ts|en\.ts" | head -20
```
Expected: no output.

- [ ] **Step 2: Manual smoke-test checklist**
  - L4 full-build step: equation is empty when await-mimic starts ✓
  - L9 entering: dice roll animation fires ✓
  - L9 stage 0: tapping equation area does nothing; tapping mini card advances to stage 1 ✓
  - L9 stage 1: equation builder works; fan locked; wrong equation shows mismatch ✓
  - L9 stage 2: fan unlocked; "בחרתי" works; pressing it advances to celebrate ✓

---

## Self-Review

**Spec coverage:**
- ✅ L4 equation empty: Task 1 adds `eqReset` on await-mimic entry.
- ✅ Remove all L9 bubbles: Task 7 suppresses `currentStep.hintKey` for L9 all stages.
- ✅ New turn dice roll: Task 4 adds `ROLL_DICE` dispatch.
- ✅ Results open automatically: existing `openResultsChip` in rigging, kept.
- ✅ Only mini card works first: Task 5 (fan block) + Task 6 (overlay for equation area).
- ✅ Bubble "בחר מיני קלף...": Task 7 adds `l9SelectMiniKey` for stage 0.
- ✅ After selection: copy + confirm + pick card + בחרתי: Tasks 3+5 (fan unblock at stage 2) + `L4Step3Mode`.
- ✅ Outcome `userPlayedCards`: Task 3.

**Placeholder scan:** No placeholders found. All steps have complete code.

**Type consistency:** `l9Stage`, `setL9Stage`, `MIMIC_IDENTICAL_LESSON_INDEX`, `l9SelectMiniKey` used consistently. `tutorialBus.setL5aBlockFanTaps`, `tutorialBus.setL4Step3Mode`, `tutorialBus.setL6CopyConfig`, `tutorialBus.subscribeUserEvent` all match existing API.
