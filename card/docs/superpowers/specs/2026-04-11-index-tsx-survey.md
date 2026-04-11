# index.tsx Survey (M1 deliverable)

**Source:** card/index.tsx
**Snapshot date:** 2026-04-11
**Purpose:** Ground truth for M2-M6 implementation of single-player vs bot feature

This survey is READ-ONLY research. Any discrepancy between this doc and
the live file means the live file is authoritative; update this doc and
re-verify any dependent implementation.

---

## 1. `gameReducer` signature

**Exact function declaration (lines 934–938):**

```typescript
function gameReducer(
  st: GameState,
  action: GameAction,
  tf: (key: string, params?: MsgParams) => string,
): GameState {
```

- **Declaration style:** Top-level `function` declaration (not a `const = () =>`). This means it is hoisted and can be referenced before its definition; it does NOT close over any outer variables — `tf` is an explicit parameter.
- **Parameters:** `st: GameState`, `action: GameAction`, `tf: (key: string, params?: MsgParams) => string`
- **Return type:** `GameState`

**How it is wrapped in `GameProvider` (lines 1511–1513):**

```typescript
  const { t } = useLocale();
  const reducer = useCallback((s: GameState, a: GameAction) => gameReducer(s, a, t), [t]);
  const [localState, localDispatch] = useReducer(reducer, initialState);
```

`gameReducer` is NOT passed directly to `useReducer`. Instead, it is wrapped in a `useCallback` that partially applies `t` (the locale-bound translate function obtained from `useLocale()`). The `useCallback` has `[t]` as its dependency array. The resulting `reducer` function (2-arg, matching React's `(state, action) => state` signature) is then passed to `useReducer`.

---

## 2. `GameState` interface

**Defined at line 195:**

```typescript
interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: DiceResult | null;
  selectedCards: Card[];
  stagedCards: Card[];
  validTargets: EquationOption[];
  equationResult: number | null;
  activeOperation: Operation | null;
  challengeSource: string | null;
  equationOpsUsed: Operation[];
  activeFraction: Fraction | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  identicalAlert: { playerName: string; cardDisplay: string; consecutive: number } | null;
  jokerModalOpen: boolean;
  /** משבצות 0/1 — קלפים מהיד בתרגיל הקוביות */
  equationHandSlots: [EquationHandSlot | null, EquationHandSlot | null];
  /** נבחר מהיד וממתין ללחיצה על משבצת אופרטור */
  equationHandPick: EquationHandSlot | null;
  lastMoveMessage: string | null;
  lastDiscardCount: number;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  diceMode: '3';
  showFractions: boolean;
  showPossibleResults: boolean;
  showSolveExercise: boolean;
  difficultyStage: DifficultyStageId;
  stageTransitions: number;
  mathRangeMax: 12 | 25;
  enabledOperators: Operation[];
  allowNegativeTargets: boolean;
  abVariant: AbVariant;
  equationAttempts: number;
  equationSuccesses: number;
  turnStartedAt: number | null;
  totalEquationResponseMs: number;
  timerSetting: '30' | '60' | 'off' | 'custom';
  timerCustomSeconds: number;
  winner: Player | null;
  message: string;
  roundsPlayed: number;
  notifications: Notification[];
  moveHistory: MoveHistoryEntry[];
  /** למשתמש חדש — הדרכה מופעלת; משמש לעדיפות להתראות onb/guidance ב־NotificationZone */
  guidanceEnabled: boolean | null;
  /** דגל חד־פעמי: האם המשתמש כבר ראה את הודעת ההדרכה מתחת לכפתור הקוביות בתור הראשון */
  hasSeenIntroHint: boolean;
  /** דגל חד־פעמי: האם המשתמש כבר ראה הסבר מה לעשות אחרי שהמשוואה נפתרה (בחירת קלפים לתוצאה) */
  hasSeenSolvedHint: boolean;
  /** משחק מקוון — מזהה הגרלת פותח (מהשרת) */
  openingDrawId?: string | null;
  /** משחק מקוון — מועד יעד (epoch ms) לפעולת תור; null כשלא במצב המתנה */
  turnDeadlineAt?: number | null;
  /** צלילי משחק — false = השתקה (נשמר ב־AsyncStorage) */
  soundsEnabled: boolean;
  /** טבלת טורניר — למשחק הנוכחי בלבד; מאופסת בתחילת כל START_GAME */
  tournamentTable: TournamentRow[];
  /** מונה שימושים בכפתור "תוצאות אפשריות" לצורך תשלום כל שימוש רביעי */
  possibleResultsInfoUses: number;
  /** ספירה רק פעם אחת בכל תור — גם אם הכפתור נלחץ כמה פעמים */
  possibleResultsInfoCountedThisTurn: boolean;
  /** מקוון: המשתמש סגר את בועת קלף זהה לפני ש-callback השני מהשרת הסיר את identicalCelebration */
  suppressIdenticalOverlayOnline: boolean;
}
```

**Flat vs nested:**

All fields listed above are **flat top-level fields** on `GameState`. There is no `hostGameSettings` or similar nesting. The following spec-relevant fields are all top-level:

| Field | Location |
|---|---|
| `enabledOperators` | top-level (`enabledOperators: Operation[]`) |
| `mathRangeMax` | top-level (`mathRangeMax: 12 \| 25`) |
| `timerSetting` | top-level (`timerSetting: '30' \| '60' \| 'off' \| 'custom'`) |
| `timerCustomSeconds` | top-level (`timerCustomSeconds: number`) |
| `allowNegativeTargets` | top-level (`allowNegativeTargets: boolean`) |
| `showFractions` | top-level (`showFractions: boolean`) |
| `showPossibleResults` | top-level (`showPossibleResults: boolean`) |
| `showSolveExercise` | top-level (`showSolveExercise: boolean`) |
| `abVariant` | top-level (`abVariant: AbVariant`) |
| `difficultyStage` | top-level (`difficultyStage: DifficultyStageId`) |
| `diceMode` | top-level (`diceMode: '3'`) |

---

## 3. `GameAction` union

**Defined at line 356:**

```typescript
type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full'; fractions: boolean; showPossibleResults: boolean; showSolveExercise: boolean; timerSetting: '30' | '60' | 'off' | 'custom'; timerCustomSeconds?: number; difficultyStage?: DifficultyStageId; enabledOperators?: Operation[]; allowNegativeTargets?: boolean; mathRangeMax?: 12 | 25; abVariant?: AbVariant }
  | { type: 'PLAY_AGAIN' }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE'; values?: DiceResult }
  | { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string; equationOps: Operation[]; equationCommits?: { cardId: string; position: 0 | 1; jokerAs: Operation | null }[] }
  | { type: 'RECORD_EQUATION_ATTEMPT' }
  | { type: 'RESET_ONLINE_EQ_UI' }
  | { type: 'REVERT_TO_BUILDING' }
  | { type: 'STAGE_CARD'; card: Card }
  | { type: 'UNSTAGE_CARD'; card: Card }
  | { type: 'CONFIRM_STAGED' }
  | { type: 'CONFIRM_TRAP_ONLY' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'SELECT_EQ_OP'; card: Card }
  | { type: 'PLACE_EQ_OP'; position: number }
  | { type: 'REMOVE_EQ_HAND_SLOT'; position: 0 | 1 }
  | { type: 'CLEAR_EQ_HAND' }
  | { type: 'CLEAR_EQ_HAND_PICK' }
  | { type: 'SELECT_EQ_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'PLAY_FRACTION'; card: Card }
  | { type: 'DEFEND_FRACTION_SOLVE'; card: Card; wildResolve?: number }
  | { type: 'DEFEND_FRACTION_PENALTY' }
  | { type: 'PLAY_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'DRAW_CARD' }
  | { type: 'CALL_LOLOS' }
  | { type: 'END_TURN' }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'OPEN_JOKER_MODAL'; card: Card }
  | { type: 'CLOSE_JOKER_MODAL' }
  | { type: 'DISMISS_IDENTICAL_ALERT' }
  | { type: 'SUPPRESS_ONLINE_IDENTICAL_OVERLAY' }
  | { type: 'CLEAR_ONLINE_IDENTICAL_SUPPRESS' }
  | { type: 'PUSH_NOTIFICATION'; payload: Notification }
  | { type: 'DISMISS_NOTIFICATION'; id: string }
  | { type: 'RESTORE_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_GUIDANCE_ENABLED'; enabled: boolean }
  | { type: 'SET_SOUNDS_ENABLED'; enabled: boolean }
  | { type: 'UPDATE_PLAYER_NAME'; playerIndex: number; name: string }
  | { type: 'DISMISS_INTRO_HINT' }
  | { type: 'USE_POSSIBLE_RESULTS_INFO' }
  | { type: 'RESET_GAME' };
```

**Per-variant analysis:**

- **`START_GAME`** — exact shape (line 357):
  `{ type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full'; fractions: boolean; showPossibleResults: boolean; showSolveExercise: boolean; timerSetting: '30' | '60' | 'off' | 'custom'; timerCustomSeconds?: number; difficultyStage?: DifficultyStageId; enabledOperators?: Operation[]; allowNegativeTargets?: boolean; mathRangeMax?: 12 | 25; abVariant?: AbVariant }`
  Note: no `isBot` or bot-related fields.

- **`PLAY_AGAIN`** — line 358: `{ type: 'PLAY_AGAIN' }` — carries NO additional fields. All settings are preserved from `st` in the reducer.

- **`CONFIRM_EQUATION`** — line 362:
  `{ type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string; equationOps: Operation[]; equationCommits?: { cardId: string; position: 0 | 1; jokerAs: Operation | null }[] }`
  Fields present: `result` (not `equationResult`), `equationDisplay`, `equationOps`, optional `equationCommits`. There is NO field named `equationResult` in the action itself.

- **`STAGE_CARD`** — line 366: `{ type: 'STAGE_CARD'; card: Card }` — carries a full **`Card` object**, NOT a `cardId` string.

- **`UNSTAGE_CARD`** — line 367: EXISTS. `{ type: 'UNSTAGE_CARD'; card: Card }` — carries a full **`Card` object**, NOT a `cardId` string.

- **`CONFIRM_STAGED`** — line 368: `{ type: 'CONFIRM_STAGED' }` — carries no additional fields.

- **`PLAY_IDENTICAL`** — line 370: `{ type: 'PLAY_IDENTICAL'; card: Card }` — carries a full **`Card` object**.

- **`PLAY_FRACTION`** — line 377: `{ type: 'PLAY_FRACTION'; card: Card }` — carries a full **`Card` object**.

- **`PLAY_OPERATION`** — does NOT exist in the union. There is no `PLAY_OPERATION` action type.

- **`PLAY_JOKER`** — line 380: EXISTS. `{ type: 'PLAY_JOKER'; card: Card; chosenOperation: Operation }` — carries the joker `Card` object and the chosen `Operation`.

- **`DEFEND_FRACTION_SOLVE`** — line 378: `{ type: 'DEFEND_FRACTION_SOLVE'; card: Card; wildResolve?: number }` — carries a full **`Card` object** (not `cardId`), plus optional `wildResolve: number` (the resolved value when a wild card is used for defense).

- **`DEFEND_FRACTION_PENALTY`** — line 379: `{ type: 'DEFEND_FRACTION_PENALTY' }` — carries no additional fields.

- **`DRAW_CARD`** — line 381: `{ type: 'DRAW_CARD' }` — carries no additional fields.

- **`END_TURN`** — line 383: `{ type: 'END_TURN' }` — carries no additional fields.

- **`BEGIN_TURN`** — line 360: `{ type: 'BEGIN_TURN' }` — carries no additional fields.

- **`ROLL_DICE`** — line 361: `{ type: 'ROLL_DICE'; values?: DiceResult }` — `values` is optional; when absent the reducer generates random dice values.

- **`NEXT_TURN`** — line 359: `{ type: 'NEXT_TURN' }` — EXISTS and is used separately from `END_TURN`. `END_TURN` calls `endTurnLogic` (a helper that advances turn and sets phase to `'turn-transition'`). `NEXT_TURN` is a separate action that also advances the player index and resets turn state. Both result in `phase: 'turn-transition'` but `END_TURN` also triggers the `endTurnLogic` side-effects (e.g., lolos forgiven message, 3-card notification). `NEXT_TURN` is used in online multiplayer.

---

## 4. `Player` interface

**Defined at line 152:**

```typescript
interface Player {
  id: number;
  name: string;
  hand: Card[];
  calledLolos: boolean;
}
```

- **`isBot: boolean`** — does **NOT** exist on the `Player` interface. There is no bot-related field anywhere in this interface.
- **`id`** is typed as `number` (not `string`). It is assigned as the player's index: `playersSeed.map((p, i) => ({ id: i, ... }))`.

---

## 5. `Card` interface and related types

**`CardType` defined at line 130:**

```typescript
type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
```

- **`'wild'`** EXISTS as a card type.
- **`'joker'`** EXISTS as a card type.

**`Card` interface defined at line 134:**

```typescript
interface Card {
  id: string;
  type: CardType;
  value?: number;
  fraction?: Fraction;
  operation?: Operation;
  /** When type === 'wild' and card was placed on discard pile — the value it represents (active range). */
  resolvedValue?: number;
  /** When type === 'fraction' and card was placed on discard pile — attack: denominator (divide by X); block: new target after fraction. */
  resolvedTarget?: number;
}
```

- **`resolvedValue?: number`** EXISTS — used when a wild card is placed on the discard pile to record the value it represents.
- **`resolvedTarget?: number`** EXISTS — used when a fraction card is placed on the discard pile.

**Supporting types (lines 131–132):**

```typescript
type Operation = '+' | '-' | 'x' | '÷';
type Fraction = '1/2' | '1/3' | '1/4' | '1/5';
```

---

## 6. Phase type

**Defined at line 162:**

```typescript
type GamePhase = 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'roll-dice' | 'game-over';
```

**Correction vs. spec:** The spec anticipated `'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'game-over'`. The live type has an **additional phase: `'roll-dice'`** not mentioned in the vs-bot spec. It appears in the code at line 8684 (`gamePhasesForToasts`). This extra phase must be accounted for in any bot phase-handling logic.

---

## 7. `START_GAME` / `PLAY_AGAIN` reducer case body

**Lines 940–1017 (fused `case 'START_GAME': case 'PLAY_AGAIN':` block):**

```typescript
    case 'START_GAME':
    case 'PLAY_AGAIN': {
      AsyncStorage.removeItem('lulos_guidance_notifications');
      const playersSeed =
        action.type === 'PLAY_AGAIN'
          ? st.players.map((p) => ({ name: p.name }))
          : action.players;
      const difficulty = action.type === 'PLAY_AGAIN' ? st.difficulty : action.difficulty;
      const stage = action.type === 'PLAY_AGAIN'
        ? st.difficultyStage
        : (action.difficultyStage ?? 'A');
      const stageCfg = DIFFICULTY_STAGE_CONFIG[stage];
      const enabledOperators = action.type === 'PLAY_AGAIN'
        ? st.enabledOperators
        : (action.enabledOperators && action.enabledOperators.length > 0 ? action.enabledOperators : stageCfg.enabledOperators);
      const allowNegativeTargets = action.type === 'PLAY_AGAIN'
        ? st.allowNegativeTargets
        : (action.allowNegativeTargets ?? stageCfg.allowNegativeTargets);
      const mathRangeMax = action.type === 'PLAY_AGAIN'
        ? st.mathRangeMax
        : (action.mathRangeMax ?? stageCfg.rangeMax);
      const abVariant = action.type === 'PLAY_AGAIN'
        ? st.abVariant
        : (action.abVariant ?? 'control_0_12_plus');
      const diceMode: GameState['diceMode'] = '3';
      const fractions = action.type === 'PLAY_AGAIN' ? st.showFractions : action.fractions;
      const showPossibleResults =
        action.type === 'PLAY_AGAIN' ? st.showPossibleResults : action.showPossibleResults;
      const showSolveExercise =
        action.type === 'PLAY_AGAIN' ? st.showSolveExercise : action.showSolveExercise;
      const timerSetting = action.type === 'PLAY_AGAIN' ? st.timerSetting : action.timerSetting;
      const timerCustomSeconds =
        action.type === 'PLAY_AGAIN' ? st.timerCustomSeconds : action.timerCustomSeconds ?? 60;
      const deck = shuffle(generateDeck(difficulty, fractions, enabledOperators, mathRangeMax));
      const { hands, remaining } = dealCards(deck, playersSeed.length, CARDS_PER_PLAYER);
      let drawPile = remaining;
      let firstDiscard: Card | undefined;
      for (let i = 0; i < drawPile.length; i++) {
        if (drawPile[i].type === 'number') {
          firstDiscard = drawPile[i];
          drawPile = [...drawPile.slice(0, i), ...drawPile.slice(i + 1)];
          break;
        }
      }
      if (!firstDiscard) { firstDiscard = drawPile[0]; drawPile = drawPile.slice(1); }
      return {
        ...initialState,
        // אל תאפס דגלי הדרכה חד־פעמיים כאשר מתחילים משחק חדש
        hasSeenIntroHint: st.hasSeenIntroHint,
        hasSeenSolvedHint: st.hasSeenSolvedHint,
        soundsEnabled: st.soundsEnabled,
        guidanceEnabled: st.guidanceEnabled,
        phase: 'turn-transition', difficulty, diceMode,
        difficultyStage: stage,
        stageTransitions: action.type === 'PLAY_AGAIN' ? st.stageTransitions : STAGE_SEQUENCE.indexOf(stage),
        mathRangeMax,
        enabledOperators,
        allowNegativeTargets,
        abVariant,
        equationAttempts: 0,
        equationSuccesses: 0,
        turnStartedAt: Date.now(),
        totalEquationResponseMs: 0,
        showFractions: fractions, showPossibleResults, showSolveExercise,
        timerSetting, timerCustomSeconds,
        players: playersSeed.map((p, i) => ({ id: i, name: p.name, hand: hands[i], calledLolos: false })),
        drawPile, discardPile: firstDiscard ? [firstDiscard] : [],
        tournamentTable:
          action.type === 'PLAY_AGAIN'
            ? st.tournamentTable
            : playersSeed.map((p, i) => ({
                playerId: i,
                playerName: p.name,
                wins: 0,
                losses: 0,
              })),
      };
    }
```

**Fields initialized from `initialState` spread (then overridden):** phase, difficulty, diceMode, difficultyStage, stageTransitions, mathRangeMax, enabledOperators, allowNegativeTargets, abVariant, equationAttempts, equationSuccesses, turnStartedAt, totalEquationResponseMs, showFractions, showPossibleResults, showSolveExercise, timerSetting, timerCustomSeconds, players, drawPile, discardPile, tournamentTable.

**Fields preserved from `st` regardless of action type:** `hasSeenIntroHint`, `hasSeenSolvedHint`, `soundsEnabled`, `guidanceEnabled`.

**Fields preserved from `st` only on `PLAY_AGAIN`:** `difficulty`, `difficultyStage`, `stageTransitions`, `mathRangeMax`, `enabledOperators`, `allowNegativeTargets`, `abVariant`, `showFractions`, `showPossibleResults`, `showSolveExercise`, `timerSetting`, `timerCustomSeconds`, `tournamentTable`.

**Player construction (exact line 1005):**

```typescript
        players: playersSeed.map((p, i) => ({ id: i, name: p.name, hand: hands[i], calledLolos: false })),
```

There is **no `isBot` field** in the player construction. The shape is exactly `{ id: i, name: p.name, hand: hands[i], calledLolos: false }`.

---

## 8. `RESET_GAME` reducer case

**Lines 1494–1496:**

```typescript
    case 'RESET_GAME':
      AsyncStorage.removeItem('lulos_guidance_notifications');
      return { ...initialState, hasSeenIntroHint: st.hasSeenIntroHint, hasSeenSolvedHint: st.hasSeenSolvedHint, soundsEnabled: st.soundsEnabled, guidanceEnabled: st.guidanceEnabled };
```

**Fields preserved from `st`:** `hasSeenIntroHint`, `hasSeenSolvedHint`, `soundsEnabled`, `guidanceEnabled`.

**All other fields:** reset to `initialState` values (spread first, then overrides).

---

## 9. `GameContext` and `GameProvider`

**`GameContext` creation (line 1507):**

```typescript
const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> }>({ state: initialState, dispatch: () => undefined });
```

**`GameProvider` function declaration (line 1508):**

```typescript
function GameProvider({ children }: { children: ReactNode }) {
```

**`localState` and `localDispatch` (line 1513):**

```typescript
  const [localState, localDispatch] = useReducer(reducer, initialState);
```

There IS a separate `localState` binding. When online (`override` is non-null), the exported `state` is a merged object that spreads `override.state` and selectively picks from `localState` for certain local-only fields. When offline, `state === localState`.

**The `state` merge logic (lines 1597–1613):**

```typescript
  const state = override
    ? {
        ...override.state,
        equationHandSlots: useServerEquationHand ? override.state.equationHandSlots : localState.equationHandSlots,
        equationHandPick: useServerEquationHand ? null : localState.equationHandPick,
        jokerModalOpen: localState.jokerModalOpen,
        selectedCards: localState.jokerModalOpen ? localState.selectedCards : override.state.selectedCards,
        notifications: localState.notifications,
        guidanceEnabled: override.state.guidanceEnabled ?? localState.guidanceEnabled,
        soundsEnabled: localState.soundsEnabled,
        identicalAlert:
          localState.suppressIdenticalOverlayOnline && override.state.identicalAlert
            ? null
            : override.state.identicalAlert,
        suppressIdenticalOverlayOnline: localState.suppressIdenticalOverlayOnline,
      }
    : localState;
```

**`<GameContext.Provider>` line (line 1641):**

```typescript
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
```

The `value` is a **fresh object literal each render** `{ state, dispatch }`. It is NOT wrapped in `useMemo`. However, `dispatch` is wrapped in `useCallback` (line 1615), and `state` is either `localState` (stable reference when unchanged) or the merged object (new reference each render when online).

**`dispatch` wrapper (lines 1615–1640):**

```typescript
  const dispatch = useCallback((action: GameAction) => {
    if (override && action.type === 'DISMISS_IDENTICAL_ALERT') {
      localDispatch({ type: 'SUPPRESS_ONLINE_IDENTICAL_OVERLAY' });
    }
    const isLocalOnlyAction =
      action.type === 'PUSH_NOTIFICATION' ||
      action.type === 'DISMISS_NOTIFICATION' ||
      action.type === 'RESTORE_NOTIFICATIONS' ||
      action.type === 'SET_GUIDANCE_ENABLED' ||
      action.type === 'SET_SOUNDS_ENABLED' ||
      action.type === 'DISMISS_INTRO_HINT';
    const eqUiActions = new Set<GameAction['type']>([
      'SELECT_EQ_OP', 'SELECT_EQ_JOKER', 'PLACE_EQ_OP', 'REMOVE_EQ_HAND_SLOT', 'CLEAR_EQ_HAND', 'CLEAR_EQ_HAND_PICK',
      'OPEN_JOKER_MODAL', 'CLOSE_JOKER_MODAL', 'RESET_ONLINE_EQ_UI',
    ]);
    const myIdx = override?.state?.myPlayerIndex;
    const canActOnline =
      !override || typeof myIdx !== 'number' || override.state.currentPlayerIndex === myIdx;
    if (isLocalOnlyAction) localDispatch(action);
    else if (override) {
      if (!canActOnline) return;
      if (eqUiActions.has(action.type)) localDispatch(action);
      if (action.type === 'CONFIRM_EQUATION') localDispatch({ type: 'RESET_ONLINE_EQ_UI' });
      override.dispatch(action);
    } else localDispatch(action);
  }, [override, localDispatch]);
```

---

## 10. Validation helpers

### `validateFractionPlay`

- **Defined inline in `index.tsx` at line 455.**
- **Exact signature:**
  ```typescript
  function validateFractionPlay(card: Card, topDiscard: Card | undefined): boolean
  ```
- Logic: returns `false` if `card` has no `.fraction` or no `topDiscard`. Accepts `topDiscard` of type `'number'` or `'wild'` only. Gets effective number via `getEffectiveNumber(topDiscard)` (handles `resolvedValue` for wilds). Returns `isDivisibleByFraction(effective, card.fraction as Fraction)`.

### `validateIdenticalPlay`

- **Defined inline in `index.tsx` at line 647.**
- **Exact signature:**
  ```typescript
  function validateIdenticalPlay(card: Card, topDiscard: Card | undefined): boolean
  ```
- Logic: wild card matches any `'number'` or `'wild'` on top. Otherwise type must match. For `'number'`: `card.value === topDiscard.value`. For `'fraction'`: `card.fraction === topDiscard.fraction`. For `'operation'`: `card.operation === topDiscard.operation`. For `'joker'`: matches any `joker`.

### `validateStagedCards`

- **Defined inline in `index.tsx` at line 679.**
- **Exact signature:**
  ```typescript
  function validateStagedCards(
    numberCards: Card[],
    opCard: Card | null,
    target: number,
    maxWild: number = 25,
  ): boolean
  ```
- Logic: validates whether the combination of number/wild cards and an optional operation card equals `target`. Handles permutations and wild card value search (0..maxWild).

### `fractionDenominator`

- **Defined inline in `index.tsx` at line 436:**
  ```typescript
  function fractionDenominator(f: Fraction): number {
    switch (f) { case '1/2': return 2; case '1/3': return 3; case '1/4': return 4; case '1/5': return 5; }
  }
  ```
  The denominator is computed by a simple switch on the `Fraction` literal. Used by `isDivisibleByFraction`.

---

## 11. i18n

### Is `tf` passed as a parameter or obtained via `useLocale()`?

`tf` (the parameter name used inside `gameReducer`) is an **explicit third parameter** to `gameReducer`. It is **not** obtained via `useLocale()` inside the reducer itself (the reducer is a plain function, not a hook).

In `GameProvider`, `t` is obtained via `useLocale()` at line 1511:

```typescript
  const { t } = useLocale();
```

Then it is closed over in the `useCallback` wrapper at line 1512:

```typescript
  const reducer = useCallback((s: GameState, a: GameAction) => gameReducer(s, a, t), [t]);
```

So `t` is captured via closure in `reducer`, but it reaches `gameReducer` as an explicit `tf` parameter.

### Type of `t` / `tf`

From `LocaleContext.tsx` line 19 and the `LocaleContextValue` type:

```typescript
type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => Promise<void>;
  t: (key: string, params?: MsgParams) => string;
  isRTL: boolean;
};
```

So the type of `t` (and `tf` in `gameReducer`) is:

```typescript
(key: string, params?: MsgParams) => string
```

Where `MsgParams = Record<string, string | number>` (from `shared/i18n/types.ts` line 7).

The underlying `t` function (from `shared/i18n/format.ts`) has signature:

```typescript
export function t(locale: AppLocale, key: string, params?: MsgParams): string
```

But `useLocale()` returns a bound version (via `useCallback`) that already has `locale` partially applied:

```typescript
  const translate = useCallback((key: string, params?: MsgParams) => t(locale, key, params), [locale]);
```

### Where are `shared/i18n/en.ts` and `shared/i18n/he.ts` imported and how are keys added?

- `en.ts` and `he.ts` are imported in `shared/i18n/format.ts` (lines 2–3):
  ```typescript
  import { he } from './he';
  import { en } from './en';
  ```
- Both files export a `Record<string, string>` object.
- New keys are added by inserting key-value pairs into both `en.ts` and `he.ts`.

**Example of an existing key (from `shared/i18n/en.ts` line 16):**

```typescript
  'game.botAlreadyHasOpponent': 'A real opponent is already in the room',
```

The corresponding entry in `he.ts` would carry the Hebrew translation for the same key. To add a new key, add the same key string to both files with the respective language's string value.

---

## 12. The render tree (lines 9209–9256)

```typescript
  let screen: React.ReactNode;
  if (playMode === 'choose') {
    screen = (
      <PlayModeChoiceScreen
        onLocal={() => setPlayMode('local')}
        onOnline={() => setPlayMode('online')}
      />
    );
  } else if (playMode === 'local') {
    if (state.phase === 'setup') screen = <StartScreen onBackToChoice={() => setPlayMode('choose')} onOpenSoundDemo={() => setPlayMode('sound-demo')} />;
    else {
      switch (state.phase) {
        case 'turn-transition': screen = <TurnTransition />; break;
        case 'pre-roll':
        case 'building':
        case 'solved':
          screen = <GameScreen />;
          break;
        case 'game-over':
          screen = <GameOver />;
          break;
        default:
          screen = <StartScreen onBackToChoice={() => setPlayMode('choose')} onOpenSoundDemo={() => setPlayMode('sound-demo')} />;
      }
    }
  } else if (playMode === 'sound-demo') {
    screen = <SoundDemoScreen onBack={() => setPlayMode('local')} />;
  } else {
    // playMode === 'online' — משחק ברשת (צפייה + מסך שחקן, מעבר אוטומטי בתורי)
    if (!mp?.inRoom) screen = <LobbyEntry onBackToChoice={() => setPlayMode('choose')} />;
    else if (!mp.serverState) screen = <LobbyScreen />;
    else {
      switch (state.phase) {
        case 'setup': screen = <LobbyEntry onBackToChoice={() => setPlayMode('choose')} />; break;
        case 'turn-transition': screen = <TurnTransition />; break;
        case 'pre-roll':
        case 'building':
        case 'solved':
          screen = <OnlineGameWrapper />;
          break;
        case 'game-over':
          screen = <GameOver />;
          break;
        default:
          screen = <LobbyEntry onBackToChoice={() => setPlayMode('choose')} />;
      }
    }
  }
```

Note: neither the `local` nor `online` branch has a case for `'roll-dice'` — that phase falls through to the `default` case (StartScreen for local, LobbyEntry for online).

---

## 13. Type exports from `index.tsx`

**Only one `export` statement exists at the top level of `index.tsx` (line 3024):**

```typescript
export type EquationBuilderRef = { resetAll: () => void } | null;
```

No `GameAction`, `GameState`, `Player`, `Card`, or other game types are currently exported from `index.tsx`.

**tsconfig.json (root):**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

There is no `isolatedModules`, `noEmit`, or any other setting that would prevent adding `export` statements to `index.tsx`. The file is treated as a standard module (it already has an `export` statement). Adding further `export type` statements for `GameAction`, `GameState`, etc. is technically straightforward.

---

## 14. Existing `StartScreen` inline component

**Function declaration (line 4643):**

```typescript
function StartScreen({ onBackToChoice, onOpenSoundDemo }: { onBackToChoice?: () => void; onOpenSoundDemo?: () => void }) {
```

**`useState` hooks (lines 4644–4686):**

```typescript
  const { t, isRTL } = useLocale();
  const { dispatch, state: gameState } = useGame();
  const safe = useGameSafeArea();
  const [playerCount, setPlayerCount] = useState(2);
  const [numberRange, setNumberRange] = useState<'easy' | 'full'>('full');
  const [difficultyStage, setDifficultyStage] = useState<DifficultyStageId>('E');
  const [enabledOperators, setEnabledOperators] = useState<Operation[]>(['+']);
  const [allowNegativeTargets, setAllowNegativeTargets] = useState(false);
  const [abVariant, setAbVariant] = useState<AbVariant>('control_0_12_plus');
  const [fractions, setFractions] = useState(true);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [showSolveExercise, setShowSolveExercise] = useState(true);
  const [timer, setTimer] = useState<'30' | '60' | 'off' | 'custom'>('off');
  const [customTimerSeconds, setCustomTimerSeconds] = useState(60);
  const [timerCustomModalOpen, setTimerCustomModalOpen] = useState(false);
  const [guidancePromptOpen, setGuidancePromptOpen] = useState(true);
  const [guidanceOn, setGuidanceOn] = useState(true);
  const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
  const [advancedStageExpanded, setAdvancedStageExpanded] = useState<DifficultyStageId | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cardsCatalogOpen, setCardsCatalogOpen] = useState(false);
  const [futureLabOpen, setFutureLabOpen] = useState(false);
  const [benefitsDemoOpen, setBenefitsDemoOpen] = useState(false);
  const [teacherScreenOpen, setTeacherScreenOpen] = useState(false);
  const [demoGradeBand, setDemoGradeBand] = useState<DemoGradeBand>('g2');
  const [demoLevel, setDemoLevel] = useState<DemoLevel>('medium');
  const [demoClassGames, setDemoClassGames] = useState(120);
  const [demoSimRunning, setDemoSimRunning] = useState(false);
  const [demoSimTurns, setDemoSimTurns] = useState(0);
  const [demoSimProgress, setDemoSimProgress] = useState(0);
  const [demoSimResult, setDemoSimResult] = useState<'success' | 'almost' | null>(null);
  const [demoSimMessage, setDemoSimMessage] = useState('');
  const [teacherKpi, setTeacherKpi] = useState({
    classAccuracy: 63,
    avgTurns: 24,
    atRiskStudents: 6,
    taskCompletion: 71,
  });
  const [teacherAlertsOn, setTeacherAlertsOn] = useState(true);
  const [teacherLastAction, setTeacherLastAction] = useState('');
  const [teacherRecommendation, setTeacherRecommendation] = useState('');
  const [teacherActionLog, setTeacherActionLog] = useState<string[]>([]);
```

**`advancedSetupOpen` hook (line 4661):**

```typescript
  const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
```

Type: `boolean`, initial value `false`.

**`HorizontalOptionWheel` usage in `StartScreen`:**

`HorizontalOptionWheel` is used at lines 5623 and 5821 (two instances, one for RTL layout, one for LTR). Example invocation (lines 5623–5632):

```typescript
                <HorizontalOptionWheel
                  options={timerWheelOptions}
                  selectedKey={timer}
                  snapFocus="leading"
                  scrollAfterSelect={(key) => key !== 'custom'}
                  onSelect={(key) => {
                    if (key === 'custom') setTimerCustomModalOpen(true);
                    else setTimer(key as '30' | '60' | 'off');
                  }}
                />
```

Props observed: `options: HorizontalWheelOption[]`, `selectedKey: string`, `snapFocus: "leading"`, `scrollAfterSelect: (key: string) => boolean`, `onSelect: (key: string) => void`.

`HorizontalWheelOption` is imported from `'./components/HorizontalOptionWheel'` (line 29):

```typescript
import { HorizontalOptionWheel, type HorizontalWheelOption } from './components/HorizontalOptionWheel';
```

The `timerWheelOptions` construction (lines 4687–4692):

```typescript
  const timerWheelOptions = useMemo((): HorizontalWheelOption[] => [
    { key: 'off', label: t('lobby.off'), accessibilityLabel: t('start.timerA11y.off') },
    { key: '30', label: t('lobby.timerSec', { n: 30 }), accessibilityLabel: t('start.timerA11y.sec30') },
    { key: '60', label: t('lobby.timerMin'), accessibilityLabel: t('start.timerA11y.min1') },
    { key: 'custom', label: t('lobby.timerCustom'), accessibilityLabel: t('start.timerA11y.custom') },
  ], [t]);
```

So `HorizontalWheelOption` has at minimum: `key: string`, `label: string`, `accessibilityLabel?: string`.

**`dispatch` calls in `StartScreen`:**

The only game-level dispatch found in `StartScreen` is the `START_GAME` dispatch in `startGame()` (lines 4828–4843):

```typescript
    dispatch({
      type: 'START_GAME',
      players,
      difficulty: numberRange,
      fractions,
      showPossibleResults,
      showSolveExercise,
      timerSetting: timer,
      timerCustomSeconds: timer === 'custom' ? customTimerSeconds : 60,
      difficultyStage,
      enabledOperators,
      allowNegativeTargets,
      mathRangeMax: numberRange === 'easy' ? 12 : 25,
      abVariant,
    });
```

No other `dispatch` calls to game actions (e.g., `RESET_GAME`, `PLAY_AGAIN`) were found in `StartScreen` itself. The `localDispatch` for `SET_GUIDANCE_ENABLED` may occur via the guidance prompt callbacks, but these go through the context's `dispatch`, not a direct `localDispatch`.

---

## 15. `initialState` constant

**Defined at line 822:**

```typescript
const initialState: GameState = {
  phase: 'setup', players: [], currentPlayerIndex: 0, drawPile: [], discardPile: [],
  dice: null, selectedCards: [], stagedCards: [], validTargets: [], equationResult: null,
  equationOpsUsed: [], activeOperation: null, challengeSource: null, activeFraction: null, pendingFractionTarget: null,
  fractionPenalty: 0, fractionAttackResolved: false, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
  consecutiveIdenticalPlays: 0, identicalAlert: null, jokerModalOpen: false, equationHandSlots: [null, null], equationHandPick: null,
  lastMoveMessage: null, lastDiscardCount: 0, lastEquationDisplay: null,
  difficulty: 'full', diceMode: '3', showFractions: true, showPossibleResults: true, showSolveExercise: true,
  difficultyStage: 'E', stageTransitions: 0, mathRangeMax: 25, enabledOperators: ['+'], allowNegativeTargets: false, abVariant: 'control_0_12_plus',
  equationAttempts: 0, equationSuccesses: 0, turnStartedAt: null, totalEquationResponseMs: 0,
  timerSetting: 'off', timerCustomSeconds: 60, winner: null, message: '',
  roundsPlayed: 0,
  notifications: [],
  moveHistory: [],
  guidanceEnabled: null,
  hasSeenIntroHint: false,
  hasSeenSolvedHint: false,
  soundsEnabled: true,
  tournamentTable: [],
  possibleResultsInfoUses: 0,
  possibleResultsInfoCountedThisTurn: false,
  suppressIdenticalOverlayOnline: false,
};
```

---

## Findings and surprises

### 1. `GamePhase` has a `'roll-dice'` phase not in the vs-bot spec

Line 162: `type GamePhase = 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'roll-dice' | 'game-over'`

The spec anticipated 6 phases; the live code has 7. The `'roll-dice'` phase is referenced in `gamePhasesForToasts` (line 8684). The screen router (section 12) does NOT handle `'roll-dice'` explicitly for local play — it falls to the `default` branch (renders `<StartScreen>`). This is likely a dormant/legacy or online-only phase. Any bot implementation must handle or safely ignore this phase.

### 2. `Player.isBot` does not exist

The `Player` interface has no `isBot` field. Adding bot support will require either (a) extending `Player` with `isBot?: boolean`, or (b) tracking bot player indices separately in `GameState`. Because `START_GAME` constructs players as `{ id: i, name: p.name, hand: hands[i], calledLolos: false }`, any bot flag must be added at that construction point.

### 3. `START_GAME` action carries no bot information

The `START_GAME` action shape has no `botPlayerIndex`, `isSinglePlayer`, or similar field. Adding vs-bot support requires adding new optional fields to the `START_GAME` action type and the `GameState` interface.

### 4. `PLAY_AGAIN` carries no fields at all

`{ type: 'PLAY_AGAIN' }` — it carries zero data. All settings are pulled from `st`. This means if `isBot` is added to `GameState`, the `PLAY_AGAIN` case will automatically preserve it (since it reads from `st`), which is probably the desired behavior for a rematch.

### 5. `CONFIRM_EQUATION` uses `result` not `equationResult`

The action field is `result: number`, not `equationResult`. The `GameState` field is `equationResult`. This naming asymmetry matters when constructing bot `CONFIRM_EQUATION` dispatches.

### 6. All card-carrying actions use full `Card` objects, not `cardId` strings

`STAGE_CARD`, `UNSTAGE_CARD`, `PLAY_IDENTICAL`, `PLAY_FRACTION`, `DEFEND_FRACTION_SOLVE`, `PLAY_JOKER`, `PLAY_OPERATION` (does not exist) all use `card: Card`. The bot implementation must supply full `Card` objects from `state.players[botIndex].hand`, not just IDs.

### 7. `PLAY_OPERATION` does not exist

There is no `PLAY_OPERATION` action type. Operation cards are played via `STAGE_CARD` (staged into the play area along with number cards) or via `SELECT_EQ_OP` / `SELECT_EQ_JOKER` / `PLACE_EQ_OP` (placed into the equation slots). The bot must use the same multi-step UI actions to play operation cards.

### 8. `GameContext.Provider` value is a fresh object literal each render

`return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>` — not memoized. This causes all `useGame()` consumers to re-render on every `GameProvider` render. Not a bug introduced by bot logic, but important context for performance.

### 9. `gameReducer` is a top-level function (hoisted) taking `tf` as explicit third arg

This means a bot can call `gameReducer` directly in tests (passing a mock `tf`) without needing React context. The bot decision-making logic could even use `gameReducer` to simulate future states.

### 10. `diceMode` is locked to `'3'` (literal type)

`diceMode: '3'` — the type is the string literal `'3'`, not a union. There is no 2-dice mode accessible via the current type system. The `initialState` sets `diceMode: '3'` and the `START_GAME` case sets `const diceMode: GameState['diceMode'] = '3'`. Bot logic always operates in 3-dice mode.

### 11. `en.ts` already has `'game.botAlreadyHasOpponent'` key

Line 16 of `shared/i18n/en.ts`: `'game.botAlreadyHasOpponent': 'A real opponent is already in the room'`. This suggests bot-related server logic already partially exists on the multiplayer server side, even though local bot play is not yet implemented.

### 12. The `t` function from `shared/i18n` used at module scope (line 32–34) has a different signature

At the module top level (line 32), the raw `t` from `shared/i18n` is imported with signature `t(locale: AppLocale, key: string, params?: MsgParams): string`. This is used for static sets like `WELCOME_NOTIFICATION_TITLES`. Inside components and `gameReducer`, the locale-bound version `(key, params?) => string` from `useLocale()` is used. These are two different call signatures — the module-level `t` requires a locale argument.
