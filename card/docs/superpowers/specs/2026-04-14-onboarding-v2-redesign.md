# Onboarding Redesign V2 — Structured 6-Screen Tutorial

## Context

The current interactive tutorial (runs inside the real game engine with bot demos) is **too fast** and the **explanatory text is insufficient**. Players can't follow what's happening. This spec replaces the current flow with a structured, deliberately-paced 6-screen onboarding that teaches each game concept separately before combining them.

Source: detailed spec provided by the user (2026-04-14).

## Goal

A player who completes the onboarding should understand:
1. How to interact with the card fan (swipe, tap)
2. Card values and how to use special cards (joker, wild)
3. Rolling dice
4. How dice results build equations
5. How to assemble equations interactively
6. Win condition + optional timer settings

## Architecture

- **Not** a single auto-advancing animation — a 6-screen guided flow with bot demos + user interactions
- Each screen gates progression on a specific user action (after watching bot demo)
- Reuses game components where possible (hand fan, card design, dice, equation builder)
- Uses React Native Animated (the project does not currently use Reanimated; keep that stack)
- Player controls pacing — no auto-advance between screens
- Bot demo animations are slower than real gameplay (2-3× slower) so users can read explanatory text

---

## Screen 1 — Fan Introduction (הדרכה אינטראקטיבית - "המניפה")

**Goal:** Get comfortable with the physical interaction of the card fan.

### UI
- Bottom third of screen: the card fan contains:
  - Target cards (numbers)
  - Operator signs (+, −)
  - One joker card
  - One wild card
- Top: title + explanation text

### Bot demo
- Bot demonstrates a left-to-right swipe, then right-to-left swipe across the fan
- Visible "finger" indicator shows the gesture
- Text: "הבוט מדגים: הסטת המניפה צד לצד"

### User action
- Prompt: "עכשיו תורך — הסט את המניפה כדי לראות את כל הקלפים"
- Progress only after user completes at least one swipe in each direction

### Acceptance
- User has swiped left and right → green checkmark → "הבנתי" button enabled

---

## Screen 2 — Card Selection + Special Values (בחירת קלפים וערכים מיוחדים)

**Goal:** Understand card numeric values and how to use joker/wild.

### UI
- Fan still at bottom
- Center: running total bubble ("סכום: 0")

### Bot demo
- Bot taps a number card (e.g., 8)
- Sum bubble animates: 0 → 8 with bounce
- Text: "כשלוחצים על קלף, ערכו מתווסף לסכום"

### User action — basic
- Prompt: "לחץ על כמה קלפים וראה איך הסכום מתעדכן"
- Each tap: card lifts + sum updates in real-time
- Minimum 2 cards tapped before special-card portion activates

### Special card logic
- When user taps **joker or wild**, a modal opens:
  - Title: "איזה מספר תרצה שאהיה?"
  - Number picker 0-25 (for wild) or operator picker (for joker)
  - On confirm: card value updates + sum recalculates
- Text: "קלף פרא יכול להיות כל מספר 0-25. קלף ג'וקר — כל פעולה"

### Acceptance
- User tapped at least 2 number cards AND resolved at least one joker/wild → advance

---

## Screen 3 — Rolling Dice (הטלת הקוביות)

**Goal:** Understand where equation numbers come from.

### UI
- Clean screen (fan hidden)
- Center: single "גלגל קוביות" button
- Button pulses (flash cue) to indicate next action

### Bot demo
- Button flashes 3× with golden glow
- Bot clicks the button
- 3 dice animate (shake → toss → settle) with existing AnimatedDice
- Numbers appear **inside** dice faces (e.g., 3, 5, 2) — not in bubbles below
- Below dice: plain digit strip "3 · 5 · 2" for easy reading
- Text: "הקוביות קובעות את המספרים לבניית המשוואות"

### User action
- None required — just tap "הבנתי" to advance
- (Optional: let user roll their own dice for tactile reinforcement)

### Acceptance
- Dice settled, user tapped "הבנתי"

---

## Screen 4 — Equation Building Mockups (בניית המשוואות)

**Goal:** Show how dice results map to target cards via equations.

### UI
- Two side-by-side "cards" (or stacked on small screens), each showing a worked example:

**Example A:**
- Dice: (5, 4, 1)
- Target card: 9
- Equation displayed: `5 + 4 = 9`

**Example B:**
- Dice: (6, 2)
- Target card: 4
- Equation displayed: `6 − 2 = 4`

- Each example fades in with stagger (A first, then B)
- Equation digits bold + large, operators prominent

### Bot demo
- For Example A: bot demonstrates "tapping" 5 → slot 1, "tapping" 4 → slot 3, "tapping" + → slot 2 (using ghost finger animation)
- Result slot lights up green with "9"
- Text: "דוגמה: עם קוביות 5, 4 ו-1 אפשר לפתור קלף 9 במשוואה 5+4=9"

### User action
- None — just read + tap "הבנתי"

### Acceptance
- User tapped "הבנתי"

---

## Screen 5 — Interactive Equation Assembly (אינטראקציית הרכבת המשוואה)

**Goal:** Master the equation builder UX — number slots and operator cycling.

### UI
- Full EquationBuilder component on screen (real game component)
- Dice already rolled (fixed values from the scenario)
- Empty slots visible

### Bot demo (first equation)
- Ghost finger taps a dice number → number auto-fills first empty slot
- Ghost finger taps second dice → fills next slot
- Ghost finger taps the `+` operator → cycles to `−`
- Equation evaluates, result appears in green
- Text: "הבוט ממלא משוואה — שים לב איך לוחצים על + כדי להחליף ל-−"

### User action (second equation — interactive)
- Bot clears equation
- Prompt: "עכשיו תורך! השלם את המשוואה השנייה"
- User must:
  - Tap dice → fill slots
  - Tap operator → cycle to the correct one
  - Confirm → equation evaluates
- Sound: success chime on correct completion
- Haptic: light vibration on wrong attempt

### Acceptance
- User completed one equation successfully → advance

---

## Screen 6 — Win Conditions + Timer Options (תנאי ניצחון ואפשרויות נוספות)

**Goal:** Understand win condition + teach optional timer.

### UI — Win condition demo
- Mini fan visual with 2 cards left
- Confetti + celebration animation
- Text: "ניצחון! המשחק נגמר כשנשארים לך רק 2 קלפים במניפה"

### UI — Timer demo
- Show timer toggle (off/30s/60s) like the real StartScreen wheel
- Bot flips it on
- Timer bar appears at top, slowly draining
- Text: "אפשר להוסיף אתגר זמן בהגדרות המשחק"

### User action
- Tap timer toggle at least once
- "!בואו נשחק" button appears → dismisses tutorial, starts real game

### Acceptance
- User tapped timer toggle, then "בואו נשחק"

---

## Technical Requirements

### Text pacing (critical)
- All explanatory text visible for minimum 4 seconds before "הבנתי" button becomes tappable
- Dim "הבנתי" button during the reading window, fade to active

### Visual cues
- Flashing buttons: golden glow pulse (1.5s cycle) on the next action target
- Ghost finger: 👆 emoji or SVG, animated along the action path

### Feedback
- Success: play `success` SFX + green flash
- Error: play `errorSoft` SFX + light haptic vibration (React Native `Vibration.vibrate(30)`)
- Transitions: `transition` SFX between screens

### Fan physics
- Current implementation uses standard `Animated.spring`
- **Do NOT introduce Reanimated** — stay on existing Animated API (user's codebase choice)
- Spring config: `friction: 8, tension: 80` — matches existing game feel

### State management
- Each screen renders as a child of `OnboardingV2Overlay`
- Progress state: `{ screenIndex: 0-5, screenAcceptance: Set<string> }`
- Persisted in AsyncStorage: `salinda_onboarding_v2_seen`

### Android-specific
- All Unicode math glyphs use ASCII fallback on Android (already established pattern)
- No `textShadow` on Android (already established)
- Use `lineHeight` explicitly on Text containing operators

---

## Files to create / modify

### New module: `src/onboarding/` (separate from `src/tutorial/` which stays as advanced mode)

| File | Purpose |
|---|---|
| `src/onboarding/OnboardingOverlay.tsx` | Top-level orchestrator — manages screenIndex, renders current screen |
| `src/onboarding/screens/Screen1_Fan.tsx` | Fan swipe tutorial |
| `src/onboarding/screens/Screen2_Cards.tsx` | Card selection + special cards |
| `src/onboarding/screens/Screen3_Dice.tsx` | Dice rolling |
| `src/onboarding/screens/Screen4_Examples.tsx` | Equation mockups |
| `src/onboarding/screens/Screen5_Assembly.tsx` | Interactive equation builder |
| `src/onboarding/screens/Screen6_WinTimer.tsx` | Win condition + timer |
| `src/onboarding/GhostFinger.tsx` | Animated ghost-finger indicator |
| `src/onboarding/AdvanceButton.tsx` | "הבנתי" button (4s read gate) |
| `src/onboarding/generateScenario.ts` | Fixed demo data for each screen |

### Modified files
- `index.tsx`: route `playMode === 'tutorial'` to `OnboardingOverlay` instead of `TutorialGameScreen`
- `shared/i18n/en.ts` + `he.ts`: add ~30 new `onboarding.*` keys

### Kept (not replaced)
- `src/tutorial/` — existing 6-lesson interactive tutorial remains available as "advanced practice" mode (exposed via a different entry point, not by default)

---

## Open questions / decisions locked in

1. **Existing tutorial stays**: don't delete `src/tutorial/` — keep as optional advanced mode.
2. **Animated API only**: do not migrate to Reanimated for this work.
3. **First-launch behavior**: `OnboardingOverlay` shows on first launch by default; replayable from start screen "?" button.
4. **Scenario data**: fixed demo dice/cards per screen for predictable teaching (not random).
5. **Hebrew-first**: all text written in Hebrew first, English translations tracked.

---

## Verification checklist

1. Each screen loads with dimmed "הבנתי" button for 4s, then activates
2. Ghost-finger animation visible and smooth during bot demos
3. Fan swipe recognition works on both LTR and RTL
4. Joker/wild modal opens and updates card value + sum
5. Dice numbers visible inside dice faces AND in digit strip below
6. Example equations render with proper operators (including Android ASCII fallback)
7. Interactive equation assembly detects completion and plays success SFX
8. Timer toggle integration works
9. Full flow completable in Hebrew AND English
10. Persists `salinda_onboarding_v2_seen` so it doesn't replay unless triggered from "?" button
