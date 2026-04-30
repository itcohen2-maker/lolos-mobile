# Parens Lesson Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 visual bugs in the parens tutorial lesson: (1) identical-card intro overlay fires between the two exercises, (2) mini results strip has a bouncy spring shimmy on open, (3) a guide hint bubble appears below the mini cards strip during await-mimic.

**Architecture:** All changes are in `InteractiveTutorialScreen.tsx` (lesson engine + render) and `index.tsx` (ResultsStrip entrance animation). No new files. No new state. Each fix is an isolated deletion or replacement.

**Tech Stack:** React Native, Animated API, tutorial engine (MimicEngine / dispatchEngine).

---

## Background / Research Findings

### Issue 1 — Transition: identical-card intro overlay
- **Where:** `InteractiveTutorialScreen.tsx` ~line 675 and ~line 3048
- When parens lesson celebrate completes → engine enters `lesson-done`.
- A special case (`if (engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX) return;`) **holds** lesson-done instead of auto-dismissing it.
- This fires a full-screen dark overlay (`rgba(5,10,22,0.93)`) with a card mockup, title from `tutorial.l9.intro.title`, and a "בואו ננסה" button.
- **Fix:** remove the hold exception → lesson-done auto-dismisses instantly (like every other lesson). Also remove the dead overlay render block.

### Issue 2 — Mini results strip shimmy
- **Where:** `index.tsx` lines 4134 and 4188 (`ResultsStripNearPile` and `ResultsStripBelowTable`)
- When `openResultsChip` fires during parens rigging, the strip entrance uses:
  `Animated.spring(stripSlide, { toValue: 0, tension: 90, friction: 12 })`
- `friction: 12` still causes overshoot/bounce on the 20→0 translateY.
- **Fix:** replace both with `Animated.timing(stripSlide, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true })`.
- **Note:** `Easing` is already imported in `index.tsx`.

### Issue 3 — Guide hint bubble below mini cards
- **Where:** `InteractiveTutorialScreen.tsx` ~lines 1948-1955 and ~line 2574
- During parens await-mimic, `l7ParensGuideBubbleKey` produces "copyFullExercise" (stage 0) and "continueParens" (stage 1) text shown in a compact bubble at `top: 400` — directly below the mini results strip.
- The pulsing animations (red chip pulse, orange parens button pulse) already guide the learner. The text bubble is redundant and visually clutters the area below the mini cards.
- **Fix:** remove `l7ParensGuideBubbleKey` from `bubbleText` computation (set it to null always). Keep `l7MismatchHintKey` — mismatch feedback still shows. Also remove `isParensLesson && engine.phase === 'await-mimic'` from `compactMid` (mismatch bubble will default to `bottom: BUBBLE_BOTTOM`).

---

## Task 1 — Fix transition: remove identical-card intro overlay

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx` (lesson-done hold + overlay render)

- [ ] **Step 1: Remove the parens lesson-done hold**

Find this effect (around line 672–675):
```typescript
useEffect(() => {
  if (engine.phase !== 'lesson-done') return;
  if (engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX) return;  // ← DELETE this line
  dispatchEngine({ type: 'DISMISS_LESSON_DONE' });
}, [engine.phase, engine.lessonIndex]);
```
Delete the line `if (engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX) return;`

- [ ] **Step 2: Remove the parens lesson-done overlay render block**

Find and delete this entire JSX block (~lines 3048–3124):
```tsx
{/* Parens lesson-done → identical-card intro: ... */}
{engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX && engine.phase === 'lesson-done' ? (() => {
  ...
  return (
    <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,22,0.93)', ... zIndex: 9300, ... }}>
      {/* Floating card mockup */}
      ...
      {/* "בואו ננסה" button */}
      <TouchableOpacity onPress={() => dispatchEngine({ type: 'DISMISS_LESSON_DONE' })} ...>
        <Text>...בואו ננסה...</Text>
      </TouchableOpacity>
    </View>
  );
})() : null}
```
Delete from the `{/* Parens lesson-done → identical-card intro:` comment line through the closing `})() : null}`.

- [ ] **Step 3: Verify TypeScript — no new errors in this file**

```bash
npx tsc --noEmit 2>&1 | grep InteractiveTutorialScreen
```
Expected: no output (no errors).

---

## Task 2 — Remove mini results strip shimmy

**Files:**
- Modify: `index.tsx` lines ~4134 and ~4188

- [ ] **Step 1: Fix ResultsStripNearPile entrance (line ~4134)**

Replace:
```typescript
Animated.spring(stripSlide, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
```
With:
```typescript
Animated.timing(stripSlide, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
```

- [ ] **Step 2: Fix ResultsStripBelowTable entrance (line ~4188)**

Replace:
```typescript
Animated.spring(stripSlide, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
```
With:
```typescript
Animated.timing(stripSlide, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
```

- [ ] **Step 3: Verify TypeScript — no new errors in index.tsx**

```bash
npx tsc --noEmit 2>&1 | grep "index.tsx" | grep -v "error TS2"
```
Expected: same pre-existing errors, no new ones.

---

## Task 3 — Remove guide hint bubble below mini cards

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx` (bubbleText + compactMid)

- [ ] **Step 1: Suppress l7ParensGuideBubbleKey in bubbleText**

Find the `bubbleText` computation (~line 1980):
```typescript
: engine.phase === 'await-mimic'
  ? (l7ParensGuideBubbleKey
      ? t(l7ParensGuideBubbleKey)
      : ... l7MismatchHintKey ? t(l7MismatchHintKey) ...)
```
Remove `l7ParensGuideBubbleKey ? t(l7ParensGuideBubbleKey) :` so `l7MismatchHintKey` is checked directly:
```typescript
: engine.phase === 'await-mimic'
  ? (l9MismatchHintKey ? t(l9MismatchHintKey) : l4Step3HintKey ? ... : l7MismatchHintKey ? t(l7MismatchHintKey) : ...)
```

- [ ] **Step 2: Remove isParensLesson+await-mimic from compactMid**

Find (~line 2574):
```typescript
const compactMid =
  (((isL6 || isFracLesson) && !isFracIntroStep) ||
    (isParensLesson && (engine.phase === 'await-mimic' || engine.phase === 'celebrate')));
```
Change to:
```typescript
const compactMid =
  (((isL6 || isFracLesson) && !isFracIntroStep) ||
    (isParensLesson && engine.phase === 'celebrate'));
```

- [ ] **Step 3: Verify TypeScript — no new errors in this file**

```bash
npx tsc --noEmit 2>&1 | grep InteractiveTutorialScreen
```
Expected: no output.

---

## Self-Review

**Spec coverage:**
- ✅ Transition fix: Tasks 1 covers the lesson-done hold + overlay removal.
- ✅ Exercise pool: Already implemented in previous session (all 6 exercises use op-,op- where parensLeft ≠ parensRight — guaranteed by 2c difference formula). No code change needed.
- ✅ Strip shimmy: Task 2 replaces spring with timing.
- ✅ Bubble below mini cards: Task 3 removes guide hints, mismatch bubble still shows at bottom.

**Placeholder scan:** No placeholders — all steps contain exact code.

**Type consistency:** `MIMIC_PARENS_LESSON_INDEX`, `dispatchEngine`, `engine.lessonIndex`, `isParensLesson`, `l7ParensGuideBubbleKey`, `l7MismatchHintKey` — all used consistently with existing variable names.
