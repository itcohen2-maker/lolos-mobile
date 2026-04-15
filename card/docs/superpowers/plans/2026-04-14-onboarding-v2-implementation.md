# Onboarding V2 (Interactive 6-Screen Tutorial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the too-fast game-based tutorial with a slow, explanatory, 6-screen interactive onboarding that teaches every core mechanic with bot demonstrations and user-controlled pacing.

**Architecture:** Each screen is an isolated component under `src/onboarding/screens/`. A top-level `OnboardingOverlay` manages screen progression, enforces a 4-second read gate before the "הבנתי" button activates, and persists completion to AsyncStorage. Ghost-finger animations demonstrate interactions before asking the user to try them. Reuses existing game primitives (AnimatedDice, GameCard, EquationBuilder) to stay visually consistent.

**Tech Stack:** React Native (Expo), Animated API (not Reanimated), AsyncStorage, expo-av for SFX, React Native Vibration, `useLocale()` hook for i18n.

**Spec:** `docs/superpowers/specs/2026-04-14-onboarding-v2-redesign.md`

---

## File Structure

### New directory: `src/onboarding/`

```
src/onboarding/
├── OnboardingOverlay.tsx          # Orchestrator
├── AdvanceButton.tsx              # "הבנתי" button with 4s read gate
├── GhostFinger.tsx                # Animated finger indicator for bot demos
├── ProgressDots.tsx               # 6-dot progress indicator at top
├── ExitPrompt.tsx                 # Skip confirmation modal
├── useReadGate.ts                 # Hook: disables advance button for N ms
├── generateScenario.ts            # Fixed demo data per screen
├── onboardingTypes.ts             # Shared types
└── screens/
    ├── Screen1Fan.tsx             # Fan swipe intro
    ├── Screen2Cards.tsx           # Card selection + specials
    ├── Screen3Dice.tsx            # Dice roll
    ├── Screen4Examples.tsx        # Equation mockups
    ├── Screen5Assembly.tsx        # Interactive equation builder
    └── Screen6WinTimer.tsx        # Win condition + timer
```

### Modified files

- `index.tsx`: route `playMode === 'tutorial'` to `OnboardingOverlay` (replaces `TutorialGameScreen`)
- `shared/i18n/en.ts`: add ~30 `onboarding.*` keys
- `shared/i18n/he.ts`: add ~30 `onboarding.*` keys

### Deleted (not in this plan — handled separately if requested)

None. Existing `src/tutorial/` stays untouched and available via a different entry (not wired by default).

---

## Pre-Task: Setup

### Task 0: Create onboarding directory structure

**Files:**
- Create: `src/onboarding/` (directory)
- Create: `src/onboarding/screens/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/onboarding/screens
```

- [ ] **Step 2: Verify directories exist**

```bash
ls src/onboarding/
# Expected: screens/
```

- [ ] **Step 3: Commit**

```bash
git add -A  # (no files yet — directory creation is deferred until first file added)
# Skip commit here — directory won't persist without files
```

---

## Task 1: Shared types (`onboardingTypes.ts`)

**Files:**
- Create: `src/onboarding/onboardingTypes.ts`

- [ ] **Step 1: Write types file**

```typescript
// src/onboarding/onboardingTypes.ts
// Shared types for the interactive onboarding flow.

export type OnboardingScreenIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const TOTAL_SCREENS = 6;
export const READ_GATE_MS = 4000; // Minimum time advance button is disabled after screen mount.

export interface OnboardingScenario {
  /** Dice used by screens 3, 4, 5. */
  dice: [number, number, number];
  /** Target card values used in screen 4 examples. */
  exampleTargetA: number;
  exampleTargetB: number;
  /** Fixed hand for screen 1/2 demo. */
  demoHand: DemoCard[];
}

export interface DemoCard {
  id: string;
  kind: 'number' | 'operator' | 'joker' | 'wild';
  value?: number;
  op?: '+' | '-' | 'x' | '÷';
}

export interface ScreenProps {
  onComplete: () => void;
  /** Called when user taps skip button inside the screen. */
  onSkip?: () => void;
  scenario: OnboardingScenario;
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep onboardingTypes`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/onboardingTypes.ts
git commit -m "feat(onboarding): add shared types for v2 tutorial flow"
```

---

## Task 2: Scenario generator (`generateScenario.ts`)

**Files:**
- Create: `src/onboarding/generateScenario.ts`

- [ ] **Step 1: Write generator**

```typescript
// src/onboarding/generateScenario.ts
// Fixed demo data for predictable teaching. Not randomized — users see same
// numbers on replay for consistent lesson delivery.

import type { OnboardingScenario, DemoCard } from './onboardingTypes';

export function generateScenario(): OnboardingScenario {
  // Dice chosen so examples 5+4=9 and 6-2=4 both work from natural dice rolls.
  // Screen 4 specifically shows examples from (5,4,1) and (6,2); screen 3 just
  // shows the player a dice roll for orientation.
  const dice: [number, number, number] = [5, 4, 1];

  const demoHand: DemoCard[] = [
    { id: 'd-num-8', kind: 'number', value: 8 },
    { id: 'd-num-12', kind: 'number', value: 12 },
    { id: 'd-num-3', kind: 'number', value: 3 },
    { id: 'd-op-plus', kind: 'operator', op: '+' },
    { id: 'd-op-minus', kind: 'operator', op: '-' },
    { id: 'd-num-9', kind: 'number', value: 9 },
    { id: 'd-num-4', kind: 'number', value: 4 },
    { id: 'd-joker', kind: 'joker' },
    { id: 'd-wild', kind: 'wild' },
  ];

  return {
    dice,
    exampleTargetA: 9,
    exampleTargetB: 4,
    demoHand,
  };
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep generateScenario`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/generateScenario.ts
git commit -m "feat(onboarding): add fixed scenario generator"
```

---

## Task 3: Read gate hook (`useReadGate.ts`)

**Files:**
- Create: `src/onboarding/useReadGate.ts`

- [ ] **Step 1: Write hook**

```typescript
// src/onboarding/useReadGate.ts
// Enforces a minimum read time before the advance button becomes tappable.
// Prevents fast-clicking through tutorial without reading the text.

import { useEffect, useState } from 'react';

/**
 * Returns `ready=true` after `ms` milliseconds since mount (or since `resetKey`
 * changes). Use `resetKey` to reset the gate when content changes within the
 * same component (e.g., bot demo → user action within one screen).
 */
export function useReadGate(ms: number, resetKey: string | number = 'init'): { ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [ms, resetKey]);

  return { ready };
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep useReadGate`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/useReadGate.ts
git commit -m "feat(onboarding): add read-gate hook for slow pacing"
```

---

## Task 4: AdvanceButton component

**Files:**
- Create: `src/onboarding/AdvanceButton.tsx`

- [ ] **Step 1: Write component**

```typescript
// src/onboarding/AdvanceButton.tsx
// Central "הבנתי" button. Disabled (dimmed) during the read gate, then fades
// to active + pulses to indicate it's tappable.

import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, Text, View, StyleSheet } from 'react-native';

interface AdvanceButtonProps {
  label: string;
  onPress: () => void;
  ready: boolean;
  isFinal?: boolean;
}

export function AdvanceButton({ label, onPress, ready, isFinal }: AdvanceButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: ready ? 1 : 0.25,
      duration: 400,
      useNativeDriver: true,
    }).start();

    if (ready) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [ready]);

  const handlePress = () => {
    if (!ready) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    onPress();
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Animated.View style={{ opacity: fade, transform: [{ scale: Animated.multiply(scale, pulse) }] }}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={ready ? 0.8 : 1}
          disabled={!ready}
          style={[styles.button, isFinal ? styles.buttonFinal : styles.buttonNormal]}
        >
          <Text style={[styles.label, isFinal && styles.labelFinal]}>{label}</Text>
          {!isFinal && <Text style={styles.arrow}>{'\u25B6'}</Text>}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
  },
  buttonNormal: {
    backgroundColor: 'rgba(255, 215, 0, 0.25)',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  buttonFinal: {
    backgroundColor: '#34A853',
    borderWidth: 0,
  },
  label: {
    fontSize: 20,
    color: '#FFD700',
    fontWeight: '700',
    marginRight: 10,
  },
  labelFinal: {
    fontSize: 22,
    color: '#fff',
    marginRight: 0,
  },
  arrow: {
    fontSize: 14,
    color: '#FFD700',
  },
});
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep AdvanceButton`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/AdvanceButton.tsx
git commit -m "feat(onboarding): add read-gated advance button"
```

---

## Task 5: GhostFinger component

**Files:**
- Create: `src/onboarding/GhostFinger.tsx`

- [ ] **Step 1: Write component**

```typescript
// src/onboarding/GhostFinger.tsx
// Animated finger indicator that demonstrates taps/swipes. Reusable across
// screens to show "the bot is doing X" via pathed animation.

import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

interface GhostFingerProps {
  /** Starting position in screen coordinates (relative to parent). */
  from: { x: number; y: number };
  /** Ending position. */
  to: { x: number; y: number };
  /** Milliseconds to traverse. */
  duration?: number;
  /** When true, fades the finger in + runs animation. Set false to hide. */
  active: boolean;
  /** Called when animation ends (if active). */
  onComplete?: () => void;
  /** Tap emphasis: true for taps, false for swipes (different dot anim). */
  tap?: boolean;
}

export function GhostFinger({
  from,
  to,
  duration = 1200,
  active,
  onComplete,
  tap = true,
}: GhostFingerProps) {
  const x = useRef(new Animated.Value(from.x)).current;
  const y = useRef(new Animated.Value(from.y)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(0);
      return;
    }
    x.setValue(from.x);
    y.setValue(from.y);
    dot.setValue(0);

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(x, { toValue: to.x, duration, useNativeDriver: true }),
        Animated.timing(y, { toValue: to.y, duration, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(dot, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      onComplete?.();
    });
  }, [active, from.x, from.y, to.x, to.y, duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateX: x }, { translateY: y }],
        },
      ]}
    >
      {/* Finger emoji */}
      <Animated.Text style={styles.finger}>{'\u{1F446}'}</Animated.Text>
      {/* Tap dot — ring that expands + fades */}
      {tap && (
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot,
              transform: [
                {
                  scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }),
                },
              ],
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
  },
  finger: {
    fontSize: 36,
  },
  dot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FFD700',
    top: 6,
    left: 6,
  },
});
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep GhostFinger`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/GhostFinger.tsx
git commit -m "feat(onboarding): add ghost-finger demo indicator"
```

---

## Task 6: ProgressDots component

**Files:**
- Create: `src/onboarding/ProgressDots.tsx`

- [ ] **Step 1: Write component**

```typescript
// src/onboarding/ProgressDots.tsx
// 6-dot progress indicator rendered at the top of the onboarding overlay.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TOTAL_SCREENS } from './onboardingTypes';

interface ProgressDotsProps {
  current: number;
}

export function ProgressDots({ current }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#FFD700',
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep ProgressDots`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/ProgressDots.tsx
git commit -m "feat(onboarding): add progress dots"
```

---

## Task 7: ExitPrompt modal

**Files:**
- Create: `src/onboarding/ExitPrompt.tsx`

- [ ] **Step 1: Write component**

```typescript
// src/onboarding/ExitPrompt.tsx
// Confirmation modal that appears when user taps the global exit button.
// Prevents accidental exits while still allowing deliberate skip.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

interface ExitPromptProps {
  visible: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExitPrompt({
  visible,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ExitPromptProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnCancel]}>
              <Text style={styles.btnCancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={[styles.btn, styles.btnConfirm]}>
              <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btnConfirm: {
    backgroundColor: '#EA4335',
  },
  btnCancelText: {
    color: '#E0E0E0',
    fontWeight: '600',
  },
  btnConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
});
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep ExitPrompt`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/ExitPrompt.tsx
git commit -m "feat(onboarding): add exit confirmation modal"
```

---

## Task 8: Add all i18n keys (en)

**Files:**
- Modify: `shared/i18n/en.ts`

- [ ] **Step 1: Append onboarding keys to en.ts**

Find the line `'tutorial.exit': 'Exit',` in `shared/i18n/en.ts`. Immediately BEFORE the closing `};` of the export object, add:

```typescript
  // ── Onboarding V2 ──
  'onboarding.gotIt': 'Got it',
  'onboarding.letsPlay': "Let's play!",
  'onboarding.skip': 'Skip',
  'onboarding.exitTitle': 'Exit the tutorial? You can replay it from the "?" button on the start screen.',
  'onboarding.exitConfirm': 'Exit',
  'onboarding.exitCancel': 'Keep going',

  // Screen 1 — Fan
  'onboarding.s1.title': 'Meet your card fan',
  'onboarding.s1.body': 'Your cards sit at the bottom of the screen. Swipe left or right to browse them.',
  'onboarding.s1.botDemo': 'Watch: the bot swipes across the fan.',
  'onboarding.s1.userTask': 'Your turn — swipe the fan once to continue.',
  'onboarding.s1.done': 'Great! You can browse your cards anytime.',

  // Screen 2 — Cards
  'onboarding.s2.title': 'Tap cards to pick them',
  'onboarding.s2.body': 'Tap a number card to select it. The sum updates in real time.',
  'onboarding.s2.botDemo': 'Watch: the bot taps a card worth 8.',
  'onboarding.s2.userTask': 'Tap at least 2 number cards.',
  'onboarding.s2.specialsBody': 'Joker and wild cards are flexible — tap one to pick its value.',
  'onboarding.s2.wildModalTitle': 'What number should this wild card be?',
  'onboarding.s2.jokerModalTitle': 'What operation should this joker be?',
  'onboarding.s2.done': 'Perfect. Specials can change any equation.',

  // Screen 3 — Dice
  'onboarding.s3.title': 'Roll the dice',
  'onboarding.s3.body': 'Every turn starts by rolling 3 dice. The numbers you roll become the building blocks for your equation.',
  'onboarding.s3.cta': 'Roll the dice',
  'onboarding.s3.done': 'Those are your numbers for this turn.',

  // Screen 4 — Examples
  'onboarding.s4.title': 'Build equations to match a target',
  'onboarding.s4.body': 'Your goal: play cards whose value matches the result of an equation you build from the dice.',
  'onboarding.s4.exampleA': 'Example A',
  'onboarding.s4.exampleB': 'Example B',

  // Screen 5 — Assembly
  'onboarding.s5.title': 'Build it yourself',
  'onboarding.s5.botDemo': 'Watch: the bot fills the equation.',
  'onboarding.s5.userTask': 'Now you try — tap dice to fill the equation.',
  'onboarding.s5.success': 'Nailed it!',
  'onboarding.s5.cycleHint': 'Tap the + sign to cycle through operators.',

  // Screen 6 — Win + Timer
  'onboarding.s6.winTitle': 'How you win',
  'onboarding.s6.winBody': 'The game ends when only 2 cards remain in your fan. First to get there wins!',
  'onboarding.s6.timerTitle': 'Add a timer (optional)',
  'onboarding.s6.timerBody': 'In game settings you can add a per-turn timer to spice things up.',
  'onboarding.s6.timerOff': 'Off',
  'onboarding.s6.timer30': '30s',
  'onboarding.s6.timer60': '60s',
  'onboarding.s6.done': "You're ready. Let's play!",
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep "shared/i18n/en"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add shared/i18n/en.ts
git commit -m "feat(i18n): add onboarding v2 en keys"
```

---

## Task 9: Add all i18n keys (he)

**Files:**
- Modify: `shared/i18n/he.ts`

- [ ] **Step 1: Append onboarding keys to he.ts**

Find the line `'tutorial.exit': 'יציאה',` in `shared/i18n/he.ts`. Immediately BEFORE `...heLateOverrides,` (which is right before the closing `};` of the main export object), add:

```typescript
  // ── Onboarding V2 ──
  'onboarding.gotIt': 'הבנתי',
  'onboarding.letsPlay': '!בואו נשחק',
  'onboarding.skip': 'דלג',
  'onboarding.exitTitle': '?לצאת מההדרכה? תוכלו לחזור אליה מכפתור "?" במסך ההתחלה',
  'onboarding.exitConfirm': 'צא',
  'onboarding.exitCancel': 'נשאר',

  // Screen 1 — Fan
  'onboarding.s1.title': 'הכירו את מניפת הקלפים',
  'onboarding.s1.body': '.הקלפים שלכם בתחתית המסך. החליקו שמאלה וימינה כדי לדפדף בהם',
  'onboarding.s1.botDemo': '.ראו: הבוט מחליק את המניפה',
  'onboarding.s1.userTask': '.תורכם — החליקו את המניפה פעם אחת כדי להמשיך',
  'onboarding.s1.done': '.מעולה! תוכלו לדפדף בקלפים בכל רגע',

  // Screen 2 — Cards
  'onboarding.s2.title': 'לחצו על קלפים כדי לבחור',
  'onboarding.s2.body': '.לחיצה על קלף מספר בוחרת אותו. הסכום מתעדכן בזמן אמת',
  'onboarding.s2.botDemo': '.ראו: הבוט לוחץ על קלף בערך 8',
  'onboarding.s2.userTask': '.לחצו לפחות על 2 קלפי מספר',
  'onboarding.s2.specialsBody': '.קלפי ג׳וקר ופרא גמישים — לחצו עליהם כדי לבחור ערך',
  'onboarding.s2.wildModalTitle': '?איזה מספר יהיה קלף הפרא',
  'onboarding.s2.jokerModalTitle': '?איזו פעולה יהיה הג׳וקר',
  'onboarding.s2.done': '.מצוין. קלפי מיוחדים יכולים לשנות כל משוואה',

  // Screen 3 — Dice
  'onboarding.s3.title': 'הטילו את הקוביות',
  'onboarding.s3.body': '.כל תור מתחיל בהטלת 3 קוביות. המספרים שיצאו הם אבני הבניין למשוואה שלכם',
  'onboarding.s3.cta': 'הטילו קוביות',
  'onboarding.s3.done': '.אלה המספרים שלכם לתור הזה',

  // Screen 4 — Examples
  'onboarding.s4.title': 'בנו משוואות כדי להתאים ליעד',
  'onboarding.s4.body': '.המטרה: להניח קלפים שערכם שווה לתוצאה של משוואה שתבנו מהקוביות',
  'onboarding.s4.exampleA': 'דוגמה א',
  'onboarding.s4.exampleB': 'דוגמה ב',

  // Screen 5 — Assembly
  'onboarding.s5.title': 'נסו בעצמכם',
  'onboarding.s5.botDemo': '.ראו: הבוט ממלא את המשוואה',
  'onboarding.s5.userTask': '.תורכם — לחצו על הקוביות כדי למלא את המשוואה',
  'onboarding.s5.success': '!יצא',
  'onboarding.s5.cycleHint': '.לחצו על סימן + כדי לעבור בין פעולות',

  // Screen 6 — Win + Timer
  'onboarding.s6.winTitle': 'איך מנצחים',
  'onboarding.s6.winBody': '.המשחק נגמר כשנשארים לכם רק 2 קלפים במניפה. הראשון שמגיע לשם — מנצח',
  'onboarding.s6.timerTitle': '(טיימר (אופציונלי',
  'onboarding.s6.timerBody': '.בהגדרות המשחק אפשר להוסיף טיימר לכל תור כדי להוסיף אתגר',
  'onboarding.s6.timerOff': 'כבוי',
  'onboarding.s6.timer30': '30 שניות',
  'onboarding.s6.timer60': '60 שניות',
  'onboarding.s6.done': '.אתם מוכנים! בואו נשחק',
```

- [ ] **Step 2: Verify TS compiles**

Run