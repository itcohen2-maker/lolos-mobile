# Tutorial Lessons 9 & 10 — Identical Card + Multi-Play Tip

## Goal

Add the final two advanced tutorial lessons:
- **Lesson 9**: identical card mechanic — place a matching card before the dice roll.
- **Lesson 10**: multi-play tip — stage 2+ cards whose sum equals the equation result, discarding multiple cards in one turn.

Both follow the existing watch-and-mimic pattern. No new UI components required.

---

## Lesson 9 — Single Identical Card (`lesson09Identical`)

**File:** `src/tutorial/lessons/lesson-09-identical.ts`

**Mechanic:** Before rolling dice, if a card in the player's hand matches the top of the discard pile (same value, or wild), the player can place it via `place_identical` — skipping the dice roll entirely.

**Structure:** 1 step.

```
{
  id: 'identical-single',
  botDemo: async (api) => { await api.wait(1000); },
  outcome: (e) => e.kind === 'identicalPlayed',
  hintKey: 'tutorial.l10.hint',
  celebrateKey: 'tutorial.l10.celebrate',
}
```

**Rigging:** phase = `pre-roll`, player hand contains exactly one card whose value matches the top of the discard pile. The bot pauses (settle time), then the player mimics by tapping the matching card.

**New i18n keys needed** (`tutorial.l10.*`):
- `title`, `desc`, `hint`, `celebrate`

Existing strings (`tutorial.identicalPractice*`) provide good copy reference — the new keys use them as a basis.

---

## Lesson 10 — Multi-Play Tip (`lesson10MultiPlay`)

**File:** `src/tutorial/lessons/lesson-10-multi-play.ts`

**Mechanic:** When the equation result is X, the player can stage any combination of number/wild/operation cards from their hand that satisfies `validateStagedCards` — not just a single card of value X. This lets them discard multiple cards in one turn.

**Structure:** 2 steps.

### Step 0 — "הידעת?" intro

```
{
  id: 'multi-play-intro',
  botDemo: async (api) => { await api.wait(500); },
  outcome: (e) => e.kind === 'identicalMultiAck',
}
```

`InteractiveTutorialScreen` detects `lessonIndex === MULTI_PLAY_LESSON_INDEX && stepId === 'multi-play-intro'` and renders a full-screen overlay:
- Icon: 💡
- Title: `tutorial.identicalMulti.didYouKnow` — "הידעת?"
- Subtitle: `tutorial.identicalMulti.bestTip` — "זה הטיפ הכי טוב שאני יכול לתת"
- Body: `tutorial.identicalMulti.body` — "אפשר להיפטר ביותר מקלף אחד בתור"
- CTA button: `tutorial.identicalMulti.cta` — "בוא ננסה" → fires `identicalMultiAck` on tutorialBus

### Step 1 — Stage 2+ cards, confirm

```
{
  id: 'multi-play-act',
  botDemo: async (api) => { await api.wait(2400); },
  outcome: (e) => e.kind === 'userPlayedCards',
  hintKey: 'tutorial.l11.hint',
  celebrateKey: 'tutorial.l11.celebrate',
}
```

`InteractiveTutorialScreen` drives the demo during the botDemo phase: dispatches `stageCardByValue(4)` → wait 600ms → `stageCardByValue(3)` → wait 600ms → `eqConfirm`. This follows the same pattern as all existing lessons where visual commands are dispatched by the screen, not from within the lesson file.

**Rigging:**
- phase = `solved`, equation result = 7 (pre-built, dice already rolled)
- Player hand contains: `4`, `3`, `0`, wild, joker — **no direct `7` card**
- Bot demos staging 4 + 3 (sum = 7), then confirms
- Player can use any valid combination; outcome fires on `userPlayedCards`

**Label shown during await-mimic:**
- `tutorial.identicalMulti.targetLabel` — "תוצאה מוכנה"
- `tutorial.identicalMulti.fanLabel` — "אופציות במניפה (כולל 0, בלי קלף היעד)"

**New i18n keys needed** (`tutorial.l11.*`):
- `hint` — "stage קלפים שמסתכמים ל-7 ולחצו בחרתי"
- `celebrate` — celebrate at end of full tutorial

---

## tutorialBus Changes

Add one new `UserEvent` variant:

```ts
/** Lesson 10 (multi-play intro): fires when the learner taps "בוא ננסה"
 *  on the הידעת? overlay, advancing to the actual play step. */
| { kind: 'identicalMultiAck' }
```

---

## index.ts Changes

```ts
import { lesson09Identical } from './lesson-09-identical';
import { lesson10MultiPlay } from './lesson-10-multi-play';

export const LESSONS: Lesson[] = [
  // ... existing 0–8 ...
  lesson09Identical,   // index 9
  lesson10MultiPlay,   // index 10
];
```

Add `MULTI_PLAY_LESSON_INDEX = 10` constant alongside the existing `MIMIC_PARENS_LESSON_INDEX`.

---

## InteractiveTutorialScreen Changes

Two new render branches in the lesson host:

1. **Lesson 9 (index 9):** Rig hand + discard for identical play. Show gameTip hint highlighting the matching card. No special overlay — standard await-mimic.

2. **Lesson 10, step 0 (index 10, stepId = 'multi-play-intro'):** Render "הידעת?" full-screen overlay on top of the game board. Overlay dismisses (fires `identicalMultiAck`) when CTA tapped.

3. **Lesson 10, step 1 (index 10, stepId = 'multi-play-act'):** Rig equation result=7 and hand as described. Show labels from `identicalMulti.targetLabel` / `identicalMulti.fanLabel`.

---

## Files Changed

| File | Change |
|---|---|
| `src/tutorial/lessons/lesson-09-identical.ts` | New file |
| `src/tutorial/lessons/lesson-10-multi-play.ts` | New file |
| `src/tutorial/lessons/index.ts` | Add imports + constants |
| `src/tutorial/tutorialBus.ts` | Add `identicalMultiAck` event |
| `src/tutorial/InteractiveTutorialScreen.tsx` | Render branches for L9 + L10 |
| `shared/i18n/he.ts` | Add `tutorial.l10.*`, `tutorial.l11.*` |
| `shared/i18n/en.ts` | Add `tutorial.l10.*`, `tutorial.l11.*` |

No changes to server, game engine, or existing lessons.
