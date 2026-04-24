# Parens Lesson Redesign — Spec

**Date:** 2026-04-24  
**Lesson index:** 7 (`parens-move`)  
**Replaces:** current single-step "move-parens" flow

---

## Goal

Teach the learner that parentheses change the equation result. The lesson has two steps:

1. **Build** — learner builds a full equation (numbers + operators + parens) that matches a target exercise shown in the red chip, then acknowledges with "הבנתי".
2. **Copy from mini card** — equation resets, mini cards strip is open; learner picks any mini card and copies its exercise (which always requires parensRight=true) into the equation and confirms.

---

## Board Setup (entry into lesson 7)

| Element | Value |
|---|---|
| Dice | d1=6, d2=2, d3=1 (fixed) |
| SolveExerciseChip (red) | Pre-opened: `6 − (2 − 1) = 5` (parensRight=true) |
| EquationBuilder | All slots empty (numbers + operators) |
| `parensRight` | `false` on entry |
| Fan | Dimmed; number cards matching possible results |

---

## Step 1 — `build-and-parens`

### Bot demo
1. Wait 1 500 ms (let learner read the red chip).
2. Pulse the parens button for 2 000 ms to draw attention.

### Bubbles
| Trigger | Key | Text (he) |
|---|---|---|
| Lesson entry (botHint) | `tutorial.l8.botIntro` | "ראה את התרגיל בכפתור האדום — בנה אותו במשוואה ולחץ על כפתור הסוגריים" |
| await-mimic (hint) | `tutorial.l8.hint` | "מלא את המשוואה לפי התרגיל, ואל תשכח לשנות את הסוגריים" |
| After second die slot filled (`eqUserPickedDice idx=1`) | `tutorial.l8.nudgeParens` | "עכשיו לחץ על כפתור הסוגריים!" |
| Confirmed without parens | `tutorial.l8.wrongParens` | "שכחת סוגריים — נסה שוב" |
| Celebrate | `tutorial.l8.celebrate1` | "כל הכבוד! בנית את המשוואה עם סוגריים!" |

### Parens button
- Text during lesson 7 only: **"ולשנות את תוצאת התרגיל"** (normal game text unchanged).
- The button alternates orange/green (existing `parensPulseVariant` cycle, every 10 s).
- The **"הבנתי" button color syncs** with the parens button: when `parensPulseVariant === 1` (green) → הבנתי is also green; otherwise orange.

### Error handling
- If learner confirms equation with `parensRight=false` → emit `l7EquationConfirmedNoParens`.
- InteractiveTutorialScreen: show `wrongParens` bubble for 2 s, then reset EquationBuilder (`CLEAR_EQ_HAND` + `eqReset`), return to normal hint.

### Outcome
Event: `l7EquationConfirmedWithParens`  
Emitted from `index.tsx` when: `state.isTutorial && lessonIndex===7 && stepIndex===0 && parensRight===true && CONFIRM_EQUATION`.

### Advance
After celebrate ack ("הבנתי") → MimicEngine advances to step 2.

---

## Step 2 — `copy-mini`

### On step entry (rigging)
- Equation resets to completely empty (automatic via rigging block on step transition).
- Mini cards strip opens fully (all mini cards visible — rigging emits `openResultsChip`).
- Fan remains dimmed (learner uses mini cards, not the fan hand).
- Red SolveExerciseChip closes on entry; reopens when learner taps a mini card (existing L6 behavior).
- Error on confirm without parens in step 2: same bubble + reset logic as step 1.

### Bot demo
1. Scroll/point to the mini cards strip.
2. Tap the first mini card (index 0).

### Bubbles
| Trigger | Key | Text (he) |
|---|---|---|
| Lesson entry (botHint) | `tutorial.l8.botPick` | "בחר מיני קלף — ראה את התרגיל שבתוכו — והעתק אותו למשוואה" |
| await-mimic (hint) | `tutorial.l8.hintPick` | "בחר מיני קלף ולחץ עליו, ואז העתק את התרגיל למשוואה" |
| Celebrate | `tutorial.l8.celebrate2` | "מעולה! עכשיו אתה יודע איך סוגריים משנים את התוצאה!" |

### Flow
1. Learner taps a mini card → red SolveExerciseChip opens showing that card's exercise (`d1 op (d2 op d3)` — always parensRight=true by design).
2. Learner fills equation to match (numbers + operators + parens toggle).
3. Learner confirms equation.

### Outcome
Event: `l7MiniCopyConfirmed`  
Emitted from `index.tsx` when: `state.isTutorial && lessonIndex===7 && stepIndex===1 && parensRight===true && CONFIRM_EQUATION`.

All mini card exercises are guaranteed to require `parensRight=true` (the rigging only includes such exercises).

---

## New Events (tutorialBus.ts)

```ts
| { kind: 'l7EquationConfirmedWithParens' }
| { kind: 'l7EquationConfirmedNoParens' }
| { kind: 'l7MiniCopyConfirmed' }
```

Remove existing: `l7ParensCopyConfirmed`, `l7ParensCopyMismatch`.

---

## i18n Keys (en + he)

| Key | EN | HE |
|---|---|---|
| `tutorial.l8.title` | Parentheses | סוגריים |
| `tutorial.l8.desc` | Learn how parentheses change the result | ללמוד איך סוגריים משנים את התוצאה |
| `tutorial.l8.botIntro` | See the exercise in the red button — build it in the equation and press the parentheses button | ראה את התרגיל בכפתור האדום — בנה אותו במשוואה ולחץ על כפתור הסוגריים |
| `tutorial.l8.hint` | Fill the equation according to the exercise, and don't forget to change the parentheses | מלא את המשוואה לפי התרגיל, ואל תשכח לשנות את הסוגריים |
| `tutorial.l8.nudgeParens` | Now press the parentheses button! | עכשיו לחץ על כפתור הסוגריים! |
| `tutorial.l8.wrongParens` | You forgot the parentheses — try again | שכחת סוגריים — נסה שוב |
| `tutorial.l8.celebrate1` | Well done! You built the equation with parentheses! | כל הכבוד! בנית את המשוואה עם סוגריים! |
| `tutorial.l8.botPick` | Choose a mini card — see the exercise inside it — and copy it to the equation | בחר מיני קלף — ראה את התרגיל שבתוכו — והעתק אותו למשוואה |
| `tutorial.l8.hintPick` | Choose a mini card and click on it, then copy the exercise to the equation | בחר מיני קלף ולחץ עליו, ואז העתק את התרגיל למשוואה |
| `tutorial.l8.celebrate2` | Excellent! Now you know how parentheses change the result! | מעולה! עכשיו אתה יודע איך סוגריים משנים את התוצאה! |

---

## Files Touched

| File | Change |
|---|---|
| `src/tutorial/lessons/lesson-07-parens.ts` | Replace with 2-step lesson (new outcomes) |
| `src/tutorial/lessons/lesson-registry.test.ts` | Update test for lesson 7 |
| `src/tutorial/tutorialBus.ts` | Add 3 new events, remove 2 old |
| `src/tutorial/InteractiveTutorialScreen.tsx` | L7 rigging block, nudge state, error handler, step-2 setup, parens+הבנתי color sync |
| `index.tsx` | Emit new L7 events on CONFIRM_EQUATION |
| `shared/i18n/en.ts` | Add 9 new keys |
| `shared/i18n/he.ts` | Add 9 new keys |
