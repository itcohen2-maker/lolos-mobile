# Tutorial — User Journey Map

**Date:** 2026-04-16
**Audience:** PM, designers, QA
**Source of truth:**
`src/tutorial/tutorialReducer.ts`, `src/tutorial/tutorialLessons.ts`, `src/tutorial/TutorialGameScreen.tsx`, `shared/botNarration.ts`

---

## High-level shape

```
Welcome  →  Mode picker  →  StartScreen  →  "?איך משחקים / How to play?"
                                                       │
                                                       ▼
                                          ┌────────────────────────┐
                                          │  TutorialGameScreen    │
                                          │  (overlays a real game)│
                                          └────────────────────────┘
                                                       │
                                                       ▼
                                          Lesson 1  →  Lesson 2  →  Lesson 3  →  Lesson 4
                                                                                     │
                                                                       (after lesson 4 wild)
                                                                                     │
                                                                                     ▼
                                                                        ┌────────────────────────┐
                                                                        │  Fractions opt-in gate │
                                                                        └────────────────────────┘
                                                                            │            │
                                                                          "yes"        "no"
                                                                            │            │
                                                                            ▼            ▼
                                                                        Lesson 5    Lesson 6
                                                                       (Identical   (Free play)
                                                                        + Fractions)
                                                                            │
                                                                            ▼
                                                                        Lesson 6
```

---

## Per-lesson breakdown

Each lesson is **one bot turn followed by one user turn**, and (for lessons 0–3) is shown **twice** — second pass is a different valid solution to the same scenario, dispatched via `NEXT_VARIANT`.

| # | Title key | Concepts | Bot steps | User steps | Dual demo? | Required cards in user hand |
|---|---|---|---|---|---|---|
| 0 | `tutorial.lesson1.title` | Numbers + addition | begin → roll → confirm-eq → stage → end (5) | begin → roll → confirm-eq → stage → confirm-staged → end (6) | ✓ | — |
| 1 | `tutorial.lesson2.title` | Operation cards (`+`, `−`, `×`) | + use-operation step | + place-operation step | ✓ | operation card |
| 2 | `tutorial.lesson3.title` | Joker | + use-joker step | + use-joker step (opens joker modal) | ✓ | joker card |
| 3 | `tutorial.lesson4.title` | Wild | + use-wild step | + use-wild step (during stage) | ✓ | wild card |
| 4 | `tutorial.lesson5.title` | Identical + Fractions (attack/defense) | begin → roll → confirm-eq → stage → end | + play-identical step before roll | ✗ | identical, fraction |
| 5 | `tutorial.lesson6.title` | Free play (all operators, fractions, no gating) | standard | standard | ✗ | — |

> Source: `src/tutorial/tutorialLessons.ts:133-235`

---

## State transitions (the interactive moments)

These are the moments where the user has agency. Everything else is scripted bot animation.

### M1 — Enter tutorial
- **Trigger:** Tap "How to play?" (`tutorial.howToPlay`) in StartScreen.
- **Effect:** `setPlayMode('tutorial')` in `index.tsx:12835` → renders `<TutorialGameScreen>`.
- **State:** `tutorialReducer` dispatches `START_TUTORIAL` on mount.

### M2 — Dismiss math onboarding overlay
- **Trigger:** First-time user; auto-shown.
- **Action:** `DISMISS_MATH_ONBOARDING`.
- **Effect:** Reveals the lesson intro card.

### M3 — Dismiss lesson intro card
- **Trigger:** User taps "Got it" on the lesson title/description card.
- **Action:** `DISMISS_LESSON_INTRO`.
- **Effect:** Bot turn auto-plays its scripted `botSteps`.

### M4 — Bot turn (no agency)
- Each `botSteps[i]` waits `botDelayMs` then dispatches `BOT_STEP_DONE`.
- Speech bubble shows `step.textKey` (e.g., `tutorial.bot.myTurn`, `tutorial.bot.rolling`).
- After last bot step → reducer flips `turn: 'user'`.

### M5 — User turn (gated agency)
- For each `userSteps[i]`, only `step.allowedActions` are accepted by the game reducer.
- Wrong tap → `WRONG_ACTION` → red flash, no state change.
- Correct tap → `USER_STEP_COMPLETED` → next user step.
- After last user step → "Lesson complete" speech bubble.

### M6 — Decide what comes next (NEW)
For lessons 0–3, after the user finishes their turn:
- If `demoVariantIndex === 0` → dispatch `NEXT_VARIANT` (auto), shows `tutorial.variant.second`, plays the same scenario with a different solution.
- If `demoVariantIndex === 1` → dispatch `NEXT_LESSON`.

> Source: `src/tutorial/TutorialGameScreen.tsx:218-227`

### M7 — Fractions opt-in gate (NEW)
Triggered when transitioning out of lesson 3 (wild) for the first time.

```
state.lessonIndex === 3 && state.fractionsOptIn === null
   └─→ awaitingFractionsOptIn = true
       speechBubble = 'tutorial.fractions.askBody'
       UI shows two buttons: yes / no
```

| User taps | Action dispatched | Next lesson |
|---|---|---|
| כן, ללמוד שברים / Yes, teach fractions | `TUTORIAL_CONFIRM_FRACTIONS_OPT_IN` `{choice:'yes'}` then `NEXT_LESSON` | Lesson 4 (Identical + Fractions) |
| לא עכשיו / Not now | `TUTORIAL_CONFIRM_FRACTIONS_OPT_IN` `{choice:'no'}` then `NEXT_LESSON` skips to | Lesson 5 (Free play) |

> Source: `src/tutorial/tutorialReducer.ts:174-206`, `TutorialGameScreen.tsx:385-405`

### M8 — Exit tutorial
- **Trigger:** Top-bar exit button (always visible — `canExit: true`).
- **Action:** `EXIT_TUTORIAL` + `RESET_GAME` + `setPlayMode('local')`.
- **Effect:** Returns to StartScreen; preserves `completed` flag for re-entry copy.

---

## Bot narration system (parallel — NOT used inside tutorial)

The tutorial has its **own** scripted speech bubbles via `tutorialLessons.ts`. They use static i18n keys like `tutorial.bot.myTurn`.

The **real** game (single-player vs bot, multiplayer) uses `shared/botNarration.ts` — a typed renderer that turns 17 bot-action kinds into `{message, body, style, emoji, autoDismissMs}`. Two consumers:

| Consumer | Where | Purpose |
|---|---|---|
| Client overlay | `index.tsx:46, 2246` | Bot offline → notification toast in single-player |
| Server emitter | `server/src/socketHandlers.ts:73, 187-190` | Multiplayer rooms broadcast bot toasts to other players |

**Why the split:** Tutorial copy is teaching-oriented and step-tied. Real-game narration is reactive ("⚔️ Fraction attack!") and multilingual via `t(locale, key, params)`.

---

## Edge cases worth keeping in mind

1. **User refuses fractions then wants them back** — `fractionsOptIn` is set permanently for the session. There's no UI to reverse. (Would need a setting in StartScreen if reversibility matters.)
2. **Mid-lesson exit** — `EXIT_TUTORIAL` resets to initial state but preserves `completed`. Restart drops user back at lesson 0.
3. **`demoVariantIndex === 1` after refresh** — not persisted; refresh restarts at 0. Acceptable since tutorial is short.
4. **Wrong-action flashing** is dismissed via `DISMISS_WRONG_ACTION` but no time-out — relies on next correct tap to clear it.
5. **`generateTutorialHand`** rigs the user's hand per `lesson + demoVariantIndex` so the chosen demo solution is always reachable. Don't break this contract when editing card generation.

---

## Test coverage

| Layer | File | What it covers |
|---|---|---|
| Reducer unit | `src/tutorial/__tests__/tutorialFlow.test.ts` | NEXT_VARIANT, opt-in gate open, opt-in 'no' skips to lesson 5 |
| i18n unit | `src/tutorial/__tests__/tutorial-i18n.test.ts` | 6 new keys exist in en + he |
| E2E entry | `tests/e2e/tutorial.spec.ts` | Navigate from lobby to first speech bubble (en + he RTL) |
| E2E gate | `tests/e2e/tutorial.spec.ts` (skipped) | Fractions opt-in dialog open + dismiss → blocked on data-testid + skip-to-lesson harness |

---

## Recommended next investments (not done)

1. **Add `data-testid` attributes** to LobbyScreens / StartScreen / TutorialSpeechBubble / TutorialHintBar / fractions prompt buttons → unblocks the skipped E2E tests.
2. **Add a `?tutorial.lesson=N` URL param** for E2E fast-forward (gated by `__DEV__` or `?e2e=1`) → makes lesson-specific tests cheap.
3. **Persist `fractionsOptIn` to AsyncStorage** if returning users should keep their choice.
4. **Bot narration → tutorial bridge** — consider letting some lesson speech bubbles re-use `botNarration.ts` rendering for tonal consistency once the user reaches free play.
