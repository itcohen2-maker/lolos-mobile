# Tutorial Lessons 9 & 10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lessons 9 (single identical card) and 10 (multi-play tip with "הידעת?" intro) to the watch-and-mimic tutorial.

**Architecture:** 7 files touched, no new components. Lesson-09 uses the existing `identicalPlayed` event (already wired at `index.tsx:7323`). Lesson-10 adds `identicalMultiAck` event + a new `TUTORIAL_FORCE_SOLVED` reducer action to bypass the normal dice→building→solved flow and jump directly to `solved` phase with `equationResult=7`. The "הידעת?" overlay is a render branch in `InteractiveTutorialScreen` keyed on `lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && stepIndex === 0 && phase === 'await-mimic'`.

**Tech Stack:** React Native, TypeScript, MimicEngine state machine, tutorialBus pub/sub, `TUTORIAL_FRACTION_SETUP` / new `TUTORIAL_FORCE_SOLVED` dispatch actions.

---

## Background / Research Findings

- `identicalPlayed` is already emitted at `index.tsx:7323` when a player taps a matching card in pre-roll during tutorial — **no change needed there**.
- `TUTORIAL_FRACTION_SETUP` (index.tsx:2576) sets `equationResult: null` — so it cannot be used to rig the `solved` phase with a known result. That is why Task 3 adds `TUTORIAL_FORCE_SOLVED`.
- `MIMIC_IDENTICAL_LESSON_INDEX` (currently = 8) drives the `advanced-complete` screen in MimicEngine. Lessons 9 and 10 come after it, so this trigger must move to index 10.
- `isAdvancedLesson` in InteractiveTutorialScreen (line ~2303) caps at `MIMIC_IDENTICAL_LESSON_INDEX` — must extend to include indices 9 and 10 so the step counter and progress bar work correctly.
- The `celebrate` phase between L10 step 0 and step 1 must skip instantly (same pattern as L6 step 0 at line ~2057).
- Internal code names follow i18n key convention: current lesson-08 is "L9" in the code (tutorial.l9.*). New lesson-09 → "L10" in code (tutorial.l10.*), new lesson-10 → "L11" in code (tutorial.l11.*).

---

## File Map

| File | Change |
|---|---|
| `src/tutorial/tutorialBus.ts` | Add `identicalMultiAck` to `UserEvent` union |
| `src/tutorial/MimicEngine.ts` | Add `MIMIC_SINGLE_IDENTICAL_LESSON_INDEX` = 9, `MIMIC_MULTI_PLAY_LESSON_INDEX` = 10; update `advanced-complete` trigger |
| `index.tsx` | Add `TUTORIAL_FORCE_SOLVED` action + reducer case |
| `shared/i18n/he.ts` + `en.ts` | Add `tutorial.l10.*` and `tutorial.l11.*` strings |
| `src/tutorial/lessons/lesson-09-identical.ts` | New file |
| `src/tutorial/lessons/lesson-10-multi-play.ts` | New file |
| `src/tutorial/lessons/index.ts` | Register both new lessons |
| `src/tutorial/InteractiveTutorialScreen.tsx` | Rigging for L10 + L11, overlay, fixes |

---

## Task 1: tutorialBus — add identicalMultiAck event

**Files:**
- Modify: `src/tutorial/tutorialBus.ts:132-134`

- [ ] **Step 1: Add the event to the UserEvent union**

Open `src/tutorial/tutorialBus.ts`. Find line 134 which currently ends the `UserEvent` union:
```ts
  /** Lesson 8 (identical card): fires when the learner taps a matching card
   *  in pre-roll, triggering PLAY_IDENTICAL. */
  | { kind: 'identicalPlayed' };
```

Replace with:
```ts
  /** Lesson 8 (identical card): fires when the learner taps a matching card
   *  in pre-roll, triggering PLAY_IDENTICAL. */
  | { kind: 'identicalPlayed' }
  /** Lesson 10 (multi-play intro): fires when the learner taps "בוא ננסה"
   *  on the הידעת? overlay, advancing to the actual play step. */
  | { kind: 'identicalMultiAck' };
```

- [ ] **Step 2: Commit**

```bash
git add src/tutorial/tutorialBus.ts
git commit -m "feat(tutorial): add identicalMultiAck event to tutorialBus"
```

---

## Task 2: MimicEngine — new lesson index constants + advanced-complete trigger

**Files:**
- Modify: `src/tutorial/MimicEngine.ts:46-52,165`

- [ ] **Step 1: Add new constants after MIMIC_IDENTICAL_LESSON_INDEX**

Find lines 49-52:
```ts
/** Parens-move lesson index — follows fractions in the advanced sequence. */
export const MIMIC_PARENS_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 2;

/** Identical-card lesson index — the final advanced lesson, after parens. */
export const MIMIC_IDENTICAL_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 3;
```

Replace with:
```ts
/** Parens-move lesson index — follows fractions in the advanced sequence. */
export const MIMIC_PARENS_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 2;

/** Mini-copy lesson index (lesson-08) — after parens. */
export const MIMIC_IDENTICAL_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 3;

/** Single identical-card play lesson index (lesson-09). */
export const MIMIC_SINGLE_IDENTICAL_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 4;

/** Multi-play tip lesson index (lesson-10) — final advanced lesson. */
export const MIMIC_MULTI_PLAY_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 5;
```

- [ ] **Step 2: Update advanced-complete trigger**

Find line ~165:
```ts
    // Identical-card is the final advanced lesson — show the advanced completion screen.
    if (state.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX) {
      return { ...state, phase: 'advanced-complete' };
    }
```

Replace with:
```ts
    // Multi-play is the final advanced lesson — show the advanced completion screen.
    if (state.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX) {
      return { ...state, phase: 'advanced-complete' };
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/tutorial/MimicEngine.ts
git commit -m "feat(tutorial): add MIMIC_SINGLE_IDENTICAL_LESSON_INDEX and MIMIC_MULTI_PLAY_LESSON_INDEX constants"
```

---

## Task 3: index.tsx — add TUTORIAL_FORCE_SOLVED action

**Files:**
- Modify: `index.tsx:674-688` (GameAction union), `index.tsx:2576` (reducer)

- [ ] **Step 1: Add action to GameAction union**

Find the `TUTORIAL_FRACTION_SETUP` action block (lines ~674-688):
```ts
  | {
      type: 'TUTORIAL_FRACTION_SETUP';
      slice: {
        ...
      };
    };
```

Add a new action **after** the closing `};` of `TUTORIAL_FRACTION_SETUP`:
```ts
  | {
      /** Skip dice/equation-build flow and jump directly to solved phase with
       *  a known result. Used by the multi-play tutorial lesson (L11). */
      type: 'TUTORIAL_FORCE_SOLVED';
      equationResult: number;
      playerHand: Card[];
      botHand: Card[];
    };
```

- [ ] **Step 2: Add reducer case**

Find the `TUTORIAL_FRACTION_SETUP` reducer case (line ~2576) and add a new case immediately after its closing `}`:
```ts
    case 'TUTORIAL_FORCE_SOLVED': {
      if (!st.isTutorial) return st;
      const pi = st.currentPlayerIndex;
      return {
        ...st,
        phase: 'solved',
        equationResult: action.equationResult,
        lastEquationDisplay: `■ + ■ = ${action.equationResult}`,
        stagedCards: [],
        hasPlayedCards: false,
        selectedCards: [],
        players: st.players.map((p, i) => {
          if (i === pi) return { ...p, hand: action.playerHand };
          if (i === 1 - pi) return { ...p, hand: action.botHand };
          return p;
        }),
        message: '',
      };
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:/Users/asus/bmad/card" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to `TUTORIAL_FORCE_SOLVED`.

- [ ] **Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat(tutorial): add TUTORIAL_FORCE_SOLVED reducer action for multi-play lesson"
```

---

## Task 4: i18n — add tutorial.l10 and tutorial.l11 strings

**Files:**
- Modify: `shared/i18n/he.ts`
- Modify: `shared/i18n/en.ts`

- [ ] **Step 1: Add Hebrew strings to he.ts**

Find the block ending with `tutorial.l9.introContinue` (line ~1203). Add after it:
```ts
  // ── Lesson 10 (L10): single identical card ──────────────────────────────
  'tutorial.l10.title': 'קלף זהה',
  'tutorial.l10.desc': 'לפני הטלת הקוביות — בדקו אם יש לכם קלף זהה לראש הערימה.',
  'tutorial.l10.hint': 'הניחו את הקלף הזהה לראש הערימה לפני שתטילו קוביות.',
  'tutorial.l10.celebrate': 'מצוין! חסכתם הטלת קוביות שלמה!',

  // ── Lesson 11 (L11): multi-play tip ─────────────────────────────────────
  'tutorial.l11.title': 'טיפ: להיפטר מיותר מקלף אחד',
  'tutorial.l11.desc': 'אפשר לנצל תוצאה אחת כדי להניח כמה קלפים ביחד.',
  'tutorial.l11.step1.hint': 'בחרו קלפים שסכומם שווה ל-7 ולחצו "בחרתי".',
  'tutorial.l11.step1.celebrate': 'ממש נכון! עכשיו אפשר לנצל כל שילוב שמסתכם לתוצאה.',
```

- [ ] **Step 2: Add English strings to en.ts**

Find the matching location in `shared/i18n/en.ts` (near the l9 strings). Add:
```ts
  // ── Lesson 10 (L10): single identical card ──────────────────────────────
  'tutorial.l10.title': 'Identical Card',
  'tutorial.l10.desc': 'Before rolling the dice — check if you have a card matching the top of the pile.',
  'tutorial.l10.hint': 'Place your identical card on the discard pile before rolling.',
  'tutorial.l10.celebrate': 'Great! You skipped a full dice roll!',

  // ── Lesson 11 (L11): multi-play tip ─────────────────────────────────────
  'tutorial.l11.title': 'Tip: Discard More Than One Card',
  'tutorial.l11.desc': 'You can use one result to play multiple cards at once.',
  'tutorial.l11.step1.hint': 'Choose cards that sum to 7 and tap "Done".',
  'tutorial.l11.step1.celebrate': 'Exactly right! Any combination that adds up to the result works.',
```

- [ ] **Step 3: Commit**

```bash
git add shared/i18n/he.ts shared/i18n/en.ts
git commit -m "feat(i18n): add tutorial.l10 and tutorial.l11 strings"
```

---

## Task 5: lesson-09-identical.ts — single identical card

**Files:**
- Create: `src/tutorial/lessons/lesson-09-identical.ts`

- [ ] **Step 1: Create the lesson file**

```ts
// ============================================================
// lesson-09-identical.ts — Single identical-card play.
// The learner is in pre-roll with one card matching the top of
// the discard pile. They tap it to skip the dice roll entirely.
// ============================================================

import type { Lesson } from './types';

export const lesson09Identical: Lesson = {
  id: 'identical-single',
  titleKey: 'tutorial.l10.title',
  descKey: 'tutorial.l10.desc',
  steps: [
    {
      id: 'identical-single-play',
      botDemo: async (api) => {
        await api.wait(1000);
      },
      outcome: (e) => e.kind === 'identicalPlayed',
      hintKey: 'tutorial.l10.hint',
      celebrateKey: 'tutorial.l10.celebrate',
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/tutorial/lessons/lesson-09-identical.ts
git commit -m "feat(tutorial): add lesson-09-identical (single identical card)"
```

---

## Task 6: lesson-10-multi-play.ts — multi-play tip

**Files:**
- Create: `src/tutorial/lessons/lesson-10-multi-play.ts`

- [ ] **Step 1: Create the lesson file**

```ts
// ============================================================
// lesson-10-multi-play.ts — Multi-play tip: stage 2+ cards
// whose sum equals the equation result, discarding them all
// in one turn. Opens with a "הידעת?" intro overlay.
// The rigged addends (addA, addB) are published by
// InteractiveTutorialScreen via tutorialBus.setL11Config()
// before this botDemo runs.
// ============================================================

import type { Lesson } from './types';

export const lesson10MultiPlay: Lesson = {
  id: 'multi-play-tip',
  titleKey: 'tutorial.l11.title',
  descKey: 'tutorial.l11.desc',
  steps: [
    {
      // Step 0 — הידעת? intro screen (rendered by InteractiveTutorialScreen).
      // botDemo just waits; the screen shows the overlay. outcome fires when
      // the learner taps "בוא ננסה".
      id: 'multi-play-intro',
      botDemo: async (api) => {
        await api.wait(500);
      },
      outcome: (e) => e.kind === 'identicalMultiAck',
    },
    {
      // Step 1 — learner stages addA + addB (random, set by rigging) and confirms.
      // Bot reads addA/addB from tutorialBus.getL11Config() so the demo always
      // matches the randomised hand.
      id: 'multi-play-act',
      botDemo: async (api) => {
        await api.wait(800);
        const cfg = api.l11Config();
        if (cfg) {
          await api.stageCardByValue(cfg.addA);
          await api.stageCardByValue(cfg.addB);
        }
        await api.eqConfirm();
      },
      outcome: (e) => e.kind === 'userPlayedCards',
      hintKey: 'tutorial.l11.step1.hint',
      celebrateKey: 'tutorial.l11.step1.celebrate',
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/tutorial/lessons/lesson-10-multi-play.ts
git commit -m "feat(tutorial): add lesson-10-multi-play (הידעת? intro + 2-card stage)"
```

---

## Task 7: lessons/index.ts — register both new lessons

**Files:**
- Modify: `src/tutorial/lessons/index.ts`

- [ ] **Step 1: Add imports and register lessons**

Open `src/tutorial/lessons/index.ts`. Current content:
```ts
import { lesson08Identical } from './lesson-08-identical';
import type { Lesson } from './types';

export const LESSONS: Lesson[] = [
  ...
  lesson08Identical,
];
```

Add the two new imports after `lesson08Identical`:
```ts
import { lesson09Identical } from './lesson-09-identical';
import { lesson10MultiPlay } from './lesson-10-multi-play';
```

And append to the LESSONS array:
```ts
export const LESSONS: Lesson[] = [
  lesson01Fan,
  lesson02Tap,
  lesson03Dice,
  lesson04Equation,
  lesson05OpCycle,
  lesson06PossibleResults,
  // Index 6 — optional fractions module.
  lesson06FractionsAdvanced,
  // Index 7 — advanced parens-move lesson (follows fractions).
  lesson07Parens,
  // Index 8 — mini-copy lesson.
  lesson08Identical,
  // Index 9 — single identical-card play.
  lesson09Identical,
  // Index 10 — multi-play tip (final advanced lesson).
  lesson10MultiPlay,
];
```

- [ ] **Step 2: Commit**

```bash
git add src/tutorial/lessons/index.ts
git commit -m "feat(tutorial): register lesson-09-identical and lesson-10-multi-play"
```

---

## Task 8: InteractiveTutorialScreen — L10 (single identical) rigging

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

Four changes in this task:

### 8a — Import new constants

Find the import from `'../tutorial/MimicEngine'` at the top of the file. Add the two new constants:
```ts
import {
  MIMIC_FIRST_FRACTION_LESSON_INDEX,
  MIMIC_IDENTICAL_LESSON_INDEX,
  MIMIC_PARENS_LESSON_INDEX,
  MIMIC_SINGLE_IDENTICAL_LESSON_INDEX,   // ← add
  MIMIC_MULTI_PLAY_LESSON_INDEX,          // ← add
  ...
} from '../tutorial/MimicEngine';
```

### 8b — Fix isAdvancedLesson range

Find line ~2303:
```ts
  const isAdvancedLesson =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex <= MIMIC_IDENTICAL_LESSON_INDEX;
```

Replace with:
```ts
  const isAdvancedLesson =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex <= MIMIC_MULTI_PLAY_LESSON_INDEX;
```

### 8c — Extend identicalAlert auto-dismiss to include L10

Find line ~850:
```ts
    if (!gameState?.identicalAlert || engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) return;
    gameDispatch({ type: 'DISMISS_IDENTICAL_ALERT' });
```

Replace with:
```ts
    if (!gameState?.identicalAlert) return;
    if (
      engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX &&
      engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX
    ) return;
    gameDispatch({ type: 'DISMISS_IDENTICAL_ALERT' });
```

### 8d — Add L10 rigging effect (randomised each run)

Add a new `useEffect` after the existing L9 mini-copy rigging block (after line ~1720). Use a ref `l10RiggedRef` (declare it with the other refs near the top of the component).

Add ref near existing `l9RiggedRef`:
```ts
const l10RiggedRef = useRef(false);
const l10LastDiscardRef = useRef(-1);
```

Add the rigging effect:
```ts
  // ── Lesson 10 (single identical): pre-roll with one matching card.
  //    Discard value is randomised every run (avoid repeating). ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) { l10RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l10RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l10RiggedRef.current) return;
    l10RiggedRef.current = true;
    // Pick a random discard value in [3..9], avoid repeating the last run.
    const pool = [3, 4, 5, 6, 7, 8, 9];
    let discardValue: number;
    do { discardValue = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 && discardValue === l10LastDiscardRef.current);
    l10LastDiscardRef.current = discardValue;
    const ts = Date.now();
    const matchCard = { id: `tut-l10-match-${ts}`, type: 'number' as const, value: discardValue };
    // Fill the rest of the hand with values different from discardValue.
    const extras = [2, 3, 4, 5, 6, 7, 8, 9]
      .filter((v) => v !== discardValue)
      .slice(0, 4)
      .map((v, i) => ({ id: `tut-l10-extra-${v}-${ts}-${i}`, type: 'number' as const, value: v }));
    const discardCard = { id: `tut-l10-discard-${ts}`, type: 'number' as const, value: discardValue };
    const playerHand = [matchCard, ...extras];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FRACTION_SETUP',
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll',
        hands: [botHand, playerHand],
        discardPile: [discardCard],
        dice: null,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: false,
        fractionKinds: [],
      },
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);
```

- [ ] **Step 1: Apply all four changes (8a–8d) in InteractiveTutorialScreen.tsx**

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:/Users/asus/bmad/card" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat(tutorial): add L10 single-identical rigging + extend identicalAlert auto-dismiss"
```

---

## Task 9: InteractiveTutorialScreen — L11 (multi-play) overlay + rigging

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

Four changes in this task:

### 9a — Instant celebrate-done for L11 step 0

Find the celebrate-timer effect at line ~2054. Inside it, after the frac-intro instant-skip block (line ~2066), add:

```ts
    // L11 (multi-play) step 0 (הידעת? intro): skip celebrate instantly.
    if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 0) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
```

### 9b — Add L11 rigging effect for step 1 (randomised each run)

Add refs near `l10RiggedRef`:
```ts
const l11RiggedRef = useRef(false);
const l11LastResultRef = useRef(-1);
```

Add a new `useEffect` after the L10 rigging effect from Task 8:

```ts
  // ── Lesson 11 (multi-play): solved phase, randomised target in [5..9].
  //    Hand contains two addends that sum to the target + wild + joker,
  //    but NO direct card whose value === target. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l11RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l11RiggedRef.current = false; return; }
    if (engine.stepIndex !== 1) return;
    if (l11RiggedRef.current) return;
    l11RiggedRef.current = true;
    // Pick a random target in [5..9], avoid repeating the last run.
    const targets = [5, 6, 7, 8, 9];
    let EQ_RESULT: number;
    do { EQ_RESULT = targets[Math.floor(Math.random() * targets.length)]; }
    while (targets.length > 1 && EQ_RESULT === l11LastResultRef.current);
    l11LastResultRef.current = EQ_RESULT;
    // Derive two addends that sum to EQ_RESULT (split roughly in half).
    const addA = Math.floor(EQ_RESULT / 2);
    const addB = EQ_RESULT - addA; // addA + addB === EQ_RESULT always
    const ts = Date.now();
    const playerCards = [addA, addB, 0].map((v, i) => ({
      id: `tut-l11-num-${v}-${ts}-${i}`, type: 'number' as const, value: v,
    }));
    const wildCard = { id: `tut-l11-wild-${ts}`, type: 'wild' as const };
    const jokerCard = { id: `tut-l11-joker-${ts}`, type: 'joker' as const };
    const playerHand = [...playerCards, wildCard, jokerCard];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: EQ_RESULT,
      playerHand,
      botHand,
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);
```

**Note:** The `botDemo` in `lesson-10-multi-play.ts` calls `api.stageCardByValue(addA)` and `api.stageCardByValue(addB)` — but because the lesson file is static, it hard-codes the values it stages. This means the lesson file must read the rigged hand to know which values to stage. Update `lesson-10-multi-play.ts` step 1's `botDemo` to use `api.stageCardByValue` with the actual rigged values.

**Solution:** Expose the current rigged result via a tutorialBus getter, similar to `getL4Config()`. Add to `tutorialBus.ts`:

```ts
// In tutorialBus.ts — add alongside existing config getters:
let l11Config: { addA: number; addB: number } | null = null;
// getter + setter:
setL11Config(cfg: { addA: number; addB: number } | null) { l11Config = cfg; }
getL11Config() { return l11Config; }
```

And in the rigging effect, after computing `addA`/`addB`:
```ts
tutorialBus.setL11Config({ addA, addB });
```

And add `l11Config()` to `DemoApi` in `BotDemonstrator.ts`:
```ts
l11Config(): { addA: number; addB: number } | null {
  return tutorialBus.getL11Config();
}
```

Then update `lesson-10-multi-play.ts` step 1 `botDemo`:
```ts
botDemo: async (api) => {
  await api.wait(800);
  const cfg = api.l11Config();
  if (cfg) {
    await api.stageCardByValue(cfg.addA);
    await api.stageCardByValue(cfg.addB);
  }
  await api.eqConfirm();
},
```

This requires also updating:
- `src/tutorial/tutorialBus.ts` (Task 9b-extra-i)
- `src/tutorial/BotDemonstrator.ts` (Task 9b-extra-ii)
- `src/tutorial/lessons/lesson-10-multi-play.ts` (update botDemo)

### 9c — Render "הידעת?" overlay for L11 step 0 await-mimic

Find the render section that handles overlays (near the `isIdenticalLesson` / `isL9CopyAwait` block, around line ~2217). Add a new derived variable:

```ts
  const isL11Intro = engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
    engine.stepIndex === 0 &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
```

Then in the JSX return, inside the tutorial overlay area, add a conditional overlay **before** the existing game board content:

```tsx
{isL11Intro && (
  <View style={styles.l11IntroOverlay}>
    <Text style={styles.l11IntroIcon}>💡</Text>
    <Text style={styles.l11IntroDyk}>{t('tutorial.identicalMulti.didYouKnow')}</Text>
    <Text style={styles.l11IntroTip}>{t('tutorial.identicalMulti.bestTip')}</Text>
    <Text style={styles.l11IntroBody}>{t('tutorial.identicalMulti.body')}</Text>
    {engine.phase === 'await-mimic' && (
      <TouchableOpacity
        style={styles.l11IntroCta}
        onPress={() => tutorialBus.emitUserEvent({ kind: 'identicalMultiAck' })}
      >
        <Text style={styles.l11IntroCtaText}>{t('tutorial.identicalMulti.cta')}</Text>
      </TouchableOpacity>
    )}
  </View>
)}
```

Add the styles in the StyleSheet at the bottom of the file:
```ts
  l11IntroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,22,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    paddingHorizontal: 32,
  },
  l11IntroIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  l11IntroDyk: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fde68a',
    marginBottom: 4,
    textAlign: 'center',
  },
  l11IntroTip: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
    textAlign: 'center',
  },
  l11IntroBody: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  l11IntroCta: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  l11IntroCtaText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
```

### 9d — No extra label logic needed for L11 step 1

The `hintKey: 'tutorial.l11.step1.hint'` defined in the lesson file is picked up automatically by the standard hint display path in InteractiveTutorialScreen. No additional render branch is needed — the game UI already shows the equation result chip in `solved` phase.

- [ ] **Step 1: Apply all four changes (9a–9d) in InteractiveTutorialScreen.tsx**

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:/Users/asus/bmad/card" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat(tutorial): add L11 multi-play overlay, rigging, and instant-celebrate skip"
```

---

## Task 10: Smoke test both new lessons end-to-end

- [ ] **Step 1: Start the app and navigate to tutorial**

Run:
```bash
cd "C:/Users/asus/bmad/card" && npx expo start
```

- [ ] **Step 2: Test Lesson 9 (single identical)**

Navigate to the advanced tutorial. Reach lesson 9 (after mini-copy lesson).
- Verify game is in `pre-roll` phase with a card in hand matching the discard pile top (value 5).
- Verify the bot demo pauses ~1 second without doing anything.
- Tap the matching card → verify `identicalPlayed` fires → celebrate → lesson-done.
- Verify no `identicalAlert` modal appears.

- [ ] **Step 3: Test Lesson 10 step 0 — הידעת? overlay**

Advance to lesson 10.
- Verify the "הידעת?" overlay appears in `await-mimic` phase.
- Verify "בוא ננסה" button is visible.
- Tap button → overlay dismisses → celebrate skips instantly → bot-demo for step 1 starts.

- [ ] **Step 4: Test Lesson 10 step 1 — multi-play**

In step 1:
- Verify game is in `solved` phase with `equationResult = 7`.
- Verify player hand contains: 4, 3, 0, wild, joker — no direct `7` card.
- Verify bot demos staging 4 + 3 and confirming.
- Mimic: stage 4 + 3 (or any valid combo summing to 7), tap confirm.
- Verify `userPlayedCards` fires → celebrate → `advanced-complete` screen.

- [ ] **Step 5: Verify step progress counter shows correct numbers**

- Verify lessons 9 and 10 appear as "advanced" lessons in the progress counter (not as core lessons).
- Verify the total advanced lesson count increases by 2.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test(tutorial): smoke test L9 + L10 — all flows verified"
```
