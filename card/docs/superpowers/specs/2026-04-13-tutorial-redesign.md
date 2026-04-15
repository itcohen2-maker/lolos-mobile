# Tutorial Redesign — Interactive "How to Play" Presentation

## Goal

Replace the current auto-advancing tutorial with a comprehensive, interactive presentation that teaches the player everything they need to play Salinda. Player controls the pace via "הבנתי" button. Card selection in the hand fan is interactive (player taps cards themselves).

## Architecture

- 7 slides, each a React component mounted/unmounted on advance
- No auto-advance — player taps "הבנתי" (centered bottom button) to move forward
- Random dice values generated on mount (different every time)
- Reuses existing game components: `AnimatedDice`, `GameCard`, `SimpleHand` (fan)
- Respects existing sound/music settings (no overrides)
- Progress dots at top (7 dots)
- First launch: auto-show. Replay via "?איך משחקים" button on start screen.
- Persists `salinda_tutorial_seen_v1` in AsyncStorage.

## Slides

### Slide 0: Title
- "!בואו נלמד לשחק סלינדה" with Salinda logo
- Slow fade-in (800ms), spring scale
- No rush — player reads and taps "הבנתי"

### Slide 1: Dice Roll
- 3 gold dice animate (AnimatedDice with `fixedFinalValues`, `autoRollOnMount`, `hideRollButton`)
- After roll settles: numbers stay **inside the dice faces** (the AnimatedDice already displays pip faces — that IS the number). No circles, no sum.
- Below dice: plain text showing the 3 values separated by commas: "6 , 2 , 3"
- Subtitle: "הקוביות קובעות את התרגיל שלך"

### Slide 2: Equation Building
- Show a list of 3-4 valid equations derived from the dice (e.g., "6 + 2 = 8", "6 + 3 = 9", "6 - 3 = 3")
- Generated from `generateValidTargets()` or hardcoded from the random dice
- Equations appear one by one (stagger fade-in, 300ms apart)
- One equation auto-highlights with golden border after all appear
- Subtitle: "בחרו תרגיל שאת התוצאה שלו יש לכם ביד"

### Slide 3: Hand Fan + Card Selection (INTERACTIVE)
- Top: the selected equation banner (e.g., "6 + 2 = 8")
- Bottom: **card fan** using the app's existing `SimpleHand` or equivalent fan layout
- Hand contains 5-6 cards: 2-3 that solve the equation + 3 distractors
- **Player taps cards themselves** — tapping a correct card highlights it gold + plays `tap` SFX
- Tapping a wrong card plays `errorSoft` SFX + brief red flash (card springs back)
- When all correct cards are selected: ✓ checkmark + `combo` SFX
- If player is stuck for 5 seconds: hint glow on the correct cards
- Subtitle before: "לחצו על הקלפים שערכם שווה לתוצאה"
- Subtitle after: "!כל הכבוד! פתרתם את התרגיל"

### Slide 4: Operation Card
- Show a GameCard of type `operation` (e.g., "×")
- Animation: the operation symbol in the equation changes (e.g., "+" → "×")
- Subtitle: "קלף פעולה מחליף את הפעולה במשוואה — פותח אפשרויות חדשות!"

### Slide 5: Fraction Card
- Show a GameCard of type `fraction` (e.g., "1/3")
- Animation: fraction card flies toward opponent bubble → opponent gets "!" badge
- Subtitle: "שחקו קלף שבר על יריב — הוא חייב לפתור תרגיל חילוק או לקבל עונש!"

### Slide 6: Wild Card + Final CTA
- Show a GameCard of type `wild` (purple)
- Animation: card appears with glow, "0-25" range badge
- Subtitle: "קלף פרא יכול להיות כל מספר מ-0 עד 25 — ג'וקר חזק!"
- Button changes from "הבנתי" to "!בואו נשחק" (green CTA) — dismisses tutorial

## Data Generation

```
On TutorialOverlay mount:
1. Roll 3 dice (1-6 each) → d1, d2, d3
2. Compute 3-4 valid equations from the dice values using +, -, x
3. Pick one equation as "selected" — ensure the result is achievable with simple cards
4. Generate 5-6 hand cards: 2-3 solve the selected equation, 3 distractors
5. Pick a random fraction (1/2, 1/3, 1/5)
6. Pick a random operation (+, -, x, ÷)
```

Pure function `generateTutorialData()` — already exists, needs expansion for equations list.

## i18n Keys (tutorial.*)

All user-visible text via `t('tutorial.*')` in both `en.ts` and `he.ts`.

## Files

### New / Rewrite
| File | Purpose |
|---|---|
| `src/tutorial/TutorialOverlay.tsx` | Orchestrator — slide management, progress dots, GotIt button |
| `src/tutorial/slides/TitleSlide.tsx` | Slide 0 |
| `src/tutorial/slides/DiceSlide.tsx` | Slide 1 — dice roll, values display |
| `src/tutorial/slides/EquationSlide.tsx` | Slide 2 — equation list, selection |
| `src/tutorial/slides/HandSlide.tsx` | Slide 3 — interactive card fan |
| `src/tutorial/slides/OperationSlide.tsx` | Slide 4 — operation card |
| `src/tutorial/slides/FractionSlide.tsx` | Slide 5 — fraction card attack |
| `src/tutorial/slides/WildSlide.tsx` | Slide 6 — wild card + final CTA |
| `src/tutorial/generateTutorialData.ts` | Random scenario + equation list |
| `src/tutorial/GotItButton.tsx` | Centered bottom advance button |

### Modified
| File | Change |
|---|---|
| `shared/i18n/en.ts` | Update `tutorial.*` keys (~20 strings) |
| `shared/i18n/he.ts` | Update `tutorial.*` keys (~20 strings) |
| `index.tsx` | Already wired — TutorialOverlay + "?" button (no changes needed) |

### Reused (read-only)
- `AnimatedDice.tsx` — dice with `fixedFinalValues`
- `components/CardDesign.tsx` — `GameCard` component
- `src/audio/sfx.ts` — `playSfx()` respects existing settings
- `src/i18n/LocaleContext.tsx` — `useLocale()` hook

### Deleted (replaced)
- `src/tutorial/scenes/DiceScene.tsx`
- `src/tutorial/scenes/EquationScene.tsx`
- `src/tutorial/scenes/CardsScene.tsx`
- `src/tutorial/scenes/FractionScene.tsx`
- `src/tutorial/scenes/WildScene.tsx`

## Android Constraints
- No `textShadow` on Android (causes invisible characters)
- Checkmark wrapped in View for centering on Android
- No `gap` in flexbox where avoidable (use `marginHorizontal`)

## Testing
1. `npx expo start --clear` → open Expo Go → tutorial auto-shows on first launch
2. Dice show random values in the die faces (not circles below)
3. No sum displayed
4. Equation list appears with 3-4 options
5. Hand fan: player can tap cards — correct ones highlight, wrong ones flash red
6. After solving: ✓ appears
7. All 7 slides work with "הבנתי" button
8. Last slide: green "!בואו נשחק" button dismisses
9. Test Hebrew + English
10. Test RTL layout
11. "?איך משחקים" button replays tutorial
