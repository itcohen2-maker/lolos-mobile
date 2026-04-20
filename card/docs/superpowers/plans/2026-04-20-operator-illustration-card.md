# Operator Illustration Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In tutorial lesson 5 step 5a (`cycle-signs`), display the real game `OperationCard` at the fan's vertical position, mirroring the operator currently selected in the equation's `?` slot, with a cover that hides the real hand during this step so the learner cognitively connects sign ↔ card.

**Architecture:** All changes live in `src/tutorial/InteractiveTutorialScreen.tsx`. Reuses the existing state `l5SelectedOp` (already driven by `index.tsx:cycleOp`) and the existing `OperationCard` component as-is. Adds two absolutely-positioned views (cover + illustration) gated on `lessonIndex === 4 && stepIndex === 0`. A short fade/scale animation plays when the operator changes. Legacy unused `L5Operand` / `L5OpCard` / `L5JokerCard` helpers are removed.

**Tech Stack:** React Native, `Animated` (native driver), existing tutorial engine + bus.

**Spec reference:** `docs/superpowers/specs/2026-04-20-operator-illustration-card-design.md`

---

## File Structure

- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`
  - Add state: `cardAnim` (Animated.Value), `prevOpRef` (useRef).
  - Add derived boolean: `showOpIllustration`.
  - Add inline helper: `mapL5OpToOperation`.
  - Add render block: cover `<View>` + animated illustration `<Animated.View>` wrapping `OperationCard`.
  - Add `useEffect` that animates `cardAnim` on `l5SelectedOp` changes.
  - Remove (cleanup): `L5Operand`, `L5OpCard`, `L5JokerCard` (dead helpers, lines ~1435–1466).

No other files change.

---

## Task 1: Render the illustration card (static) + cover to hide fan

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

- [ ] **Step 1.1: Add derived boolean and operator mapper near existing `isOpCycleLesson`**

Find the block around line 941 where other lesson booleans are declared:

```tsx
const isOpCycleLesson = engine.lessonIndex === 4;
```

Add immediately below it:

```tsx
// Lesson 5a — show a full OperationCard at fan height mirroring the
// operator currently selected in the equation's `?` slot. Visible during
// bot-demo, await-mimic, and celebrate phases of cycle-signs.
const showOpIllustration =
  engine.lessonIndex === 4 &&
  engine.stepIndex === 0 &&
  (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');

// L5Op → OperationCard.operation shape mapping. Matches what the real
// game's state produces: '*' for multiply, '/' for divide, raw for +/−.
const mapL5OpToOperation = (op: L5Op): string =>
  op === 'x' ? '*' : op === '÷' ? '/' : op;
```

- [ ] **Step 1.2: Add `cardAnim` alongside other Animated values**

Find line 305 (near other `l5…` Animated refs):

```tsx
const l5SlotPulse = useRef(new Animated.Value(0)).current;
```

Add immediately below:

```tsx
// Cardswap animation value. 0 = hidden/small, 1 = resting (scale 1.25).
// Initialized at 1 — Task 2 changes this to 0 when the full animation
// sequence is wired up.
const cardAnim = useRef(new Animated.Value(1)).current;
```

- [ ] **Step 1.3: Add the cover + illustration render block**

Find the JSX block around line 1126–1128 (the comment `{/* Lesson 5 runs on the real game UI (EquationBuilder + hand) — ... */}`). Insert the new render block **immediately after** that comment block, **before** the exit/skip buttons at line 1136:

```tsx
{/* Lesson 5a — illustration card at fan height + opaque cover hiding the
    real hand. The cover is full-width up to FAN_VISUAL_TOP_FROM_BOTTOM,
    painted in the game's background color so the fan is invisible. The
    illustration card sits centered horizontally in the middle of the
    fan strip band. */}
{showOpIllustration ? (
  <>
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: FAN_VISUAL_TOP_FROM_BOTTOM,
        backgroundColor: '#0a1628',
        zIndex: 9050,
      }}
    />
    {l5SelectedOp !== null ? (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: FAN_BOTTOM + (FAN_STRIP_H - 130) / 2,
          alignItems: 'center',
          zIndex: 9100,
          opacity: cardAnim,
          transform: [
            {
              scale: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1.25],
              }),
            },
          ],
        }}
      >
        <OperationCard
          card={{
            id: 'tut-l5-show-op',
            type: 'operation',
            operation: mapL5OpToOperation(l5SelectedOp),
          } as any}
        />
      </Animated.View>
    ) : null}
  </>
) : null}
```

- [ ] **Step 1.4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 new errors. If `l5SelectedOp`, `FAN_BOTTOM`, `FAN_STRIP_H`, `FAN_VISUAL_TOP_FROM_BOTTOM`, `OperationCard`, or `L5Op` are reported unresolved, recheck that the new code was placed inside the same component function where those are defined/in scope.

- [ ] **Step 1.5: Manual smoke test**

Start the app (`npm start` / `expo start`), open the tutorial, advance to lesson 5 step 5a. Verify:

1. Equation shows two numbers with a pulsing `?` slot.
2. Fan area (bottom of screen) is blank — no joker, no number cards visible through the cover.
3. No illustration card visible yet (before first tap).
4. Tap the `?` slot — slot changes to `+` and orange/cream `OperationCard` appears centered at fan height, ~130px tall, showing `+`.
5. Tap again — slot + card both update to `−`, then `×`, then `÷`. (No fancy animation yet; card just pops.)
6. After all 4 signs seen, step advances to 5b. Cover + illustration disappear. Real hand with joker becomes visible.

- [ ] **Step 1.6: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat(tutorial): add OperationCard illustration at fan height in lesson 5a

Lesson 5 step 5a now shows the real game OperationCard at the fan's
normal vertical position, mirroring the operator currently selected in
the equation's ? slot. An opaque cover hides the real hand during 5a.
No animation yet — that arrives in the next commit."
```

---

## Task 2: Add swap animation on operator change

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

- [ ] **Step 2.1: Change `cardAnim` initial value to 0**

Find the line added in Task 1 step 1.2:

```tsx
const cardAnim = useRef(new Animated.Value(1)).current;
```

Replace with:

```tsx
const cardAnim = useRef(new Animated.Value(0)).current;
// Tracks the previous l5SelectedOp so the effect can distinguish first
// appearance (null → op) from a swap (op → different op).
const prevL5OpRef = useRef<L5Op | null>(null);
```

- [ ] **Step 2.2: Add the animation effect**

Find the existing `l5SlotPulse` effect block (around lines 857–869). Insert the new effect **immediately after** it:

```tsx
// Lesson 5a card animation — drives `cardAnim` when the selected operator
// changes. First appearance (null → op): fade/scale in over 180ms.
// Subsequent swap (op → different op): shrink/fade out 120ms, then back
// in 180ms, creating a quick "flip" feel between signs.
useEffect(() => {
  if (engine.lessonIndex !== 4 || engine.stepIndex !== 0) {
    cardAnim.setValue(0);
    prevL5OpRef.current = null;
    return;
  }
  if (l5SelectedOp === null) {
    cardAnim.setValue(0);
    prevL5OpRef.current = null;
    return;
  }
  if (prevL5OpRef.current === null) {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  } else if (prevL5OpRef.current !== l5SelectedOp) {
    Animated.sequence([
      Animated.timing(cardAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }
  prevL5OpRef.current = l5SelectedOp;
}, [engine.lessonIndex, engine.stepIndex, l5SelectedOp, cardAnim]);
```

- [ ] **Step 2.3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 new errors.

- [ ] **Step 2.4: Manual smoke test**

Reload the app. Enter lesson 5 step 5a. Verify:

1. First tap on `?` slot — card fades/scales IN smoothly (~180ms) rather than hard-popping.
2. Subsequent taps — card briefly shrinks + fades (~120ms), then the new operator scales back in (~180ms). Noticeable "flip" feel.
3. Moving to step 5b resets: cover + card unmount cleanly, real hand appears.
4. If you navigate back into step 5a (via the tutorial's "חזור" button), the card resets to hidden and re-animates on the next tap.

- [ ] **Step 2.5: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "feat(tutorial): animate OperationCard swap in lesson 5a

First appearance fades/scales in over 180ms; subsequent operator changes
play a 120ms shrink + 180ms scale-in \"flip\". Uses native driver on
opacity + transform.scale."
```

---

## Task 3: Remove unused legacy helpers

**Files:**
- Modify: `src/tutorial/InteractiveTutorialScreen.tsx`

Background: `L5Operand`, `L5OpCard`, `L5JokerCard` were authored for a legacy scratch-canvas approach to lesson 5 that was replaced by the real-game-UI approach. Grep confirmed they have no callers in the codebase. Their imports (`OperationCard`, `JokerCard`) remain needed — `OperationCard` by the new illustration code from Task 1, `JokerCard` check during cleanup.

- [ ] **Step 3.1: Verify zero remaining callers (belt + suspenders)**

Run:

```bash
grep -rn "L5Operand\|L5OpCard\|L5JokerCard" src/ index.tsx App.tsx GameScreen.tsx 2>/dev/null
```

Expected: matches ONLY inside `src/tutorial/InteractiveTutorialScreen.tsx` (the function declarations themselves) — nowhere else. If callers exist, stop and raise it before deleting.

- [ ] **Step 3.2: Delete the three helper functions**

Remove lines ~1432–1466 (the `// ── Lesson-5 presentation helpers ──` comment block and the three function definitions):

```tsx
// ── Lesson-5 presentation helpers (kept local to this file — the tutorial
//    owns its scratch canvas visuals, intentionally not sharing the game's
//    Card components to avoid pulling the game state/hooks into the overlay). ──
function L5Operand({ value }: { value: number }): React.ReactElement {
  return (
    <View
      style={{
        width: 62,
        height: 78,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#60A5FA',
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 32, fontWeight: '900', color: '#1D4ED8' }}>{value}</Text>
    </View>
  );
}

function L5OpCard({ op, highlighted }: { op: '+' | '-' | 'x' | '÷'; highlighted: boolean }): React.ReactElement {
  const card = { id: `l5-op-${op}`, type: 'operation' as const, operation: op === 'x' ? '*' : op === '÷' ? '/' : op };
  return (
    <View style={{ transform: highlighted ? [{ scale: 1.12 }] : undefined }}>
      <OperationCard card={card as any} selected={highlighted} small />
    </View>
  );
}

function L5JokerCard({ label: _label }: { label: string }): React.ReactElement {
  const card = { id: 'l5-joker', type: 'joker' as const };
  return <JokerCard card={card as any} small />;
}
```

Delete all of it.

- [ ] **Step 3.3: Check import of `JokerCard` — remove if now unused**

Run:

```bash
grep -n "JokerCard" src/tutorial/InteractiveTutorialScreen.tsx
```

If the only remaining match is the `import JokerCard from ...` line, remove that import too:

```tsx
import JokerCard from '../components/cards/JokerCard';
```

If `JokerCard` still has other references (e.g., elsewhere in the file), leave the import alone.

`OperationCard` import must stay — it's used by the new illustration code from Task 1.

- [ ] **Step 3.4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 new errors. If an error mentions `JokerCard` unused, re-check step 3.3 — if truly unused, remove import; if used, the error is something else and needs investigation.

- [ ] **Step 3.5: Run the tutorial test suite as a regression guard**

Run: `npx jest src/tutorial`
Expected: all tests pass. These tests don't cover the new render directly but would fail if any of the removed helpers had been referenced through an indirect path.

- [ ] **Step 3.6: Commit**

```bash
git add src/tutorial/InteractiveTutorialScreen.tsx
git commit -m "chore(tutorial): remove unused L5 scratch-canvas helpers

L5Operand, L5OpCard, L5JokerCard were leftovers from the pre-real-game-UI
lesson 5 approach. The new OperationCard illustration uses the real game
component directly, so these helpers have no callers."
```

---

## Final verification

After all three tasks are committed:

- [ ] **Verify git log looks right**

Run: `git log --oneline -5`
Expected: three new commits on top — `feat(tutorial): add OperationCard illustration...`, `feat(tutorial): animate OperationCard swap...`, `chore(tutorial): remove unused L5 scratch-canvas helpers` — in that order.

- [ ] **End-to-end manual walkthrough**

Run the tutorial from lesson 1 through completion. Pay particular attention to:

1. Lesson 5 step 5a: the `?` slot in the equation still pulses before any tap. First tap shows card with smooth fade/scale in. Cycling through all 4 operators works, each swap plays the flip animation.
2. Lesson 5 step 5b: cover + illustration card disappear; real hand with joker becomes tappable; joker flow behaves as before.
3. Other lessons (1–4, 6): unchanged. The new illustration is gated on `lessonIndex === 4 && stepIndex === 0` so nothing else should be affected.
