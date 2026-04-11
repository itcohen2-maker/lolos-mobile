# Server Bot Reference (M1 companion deliverable)

**Sources:**
- card/server/src/socketHandlers.ts:260-500
- card/server/src/gameEngine.ts (function signatures)
- card/shared/types.ts (HostGameSettings)

**Snapshot date:** 2026-04-11
**Purpose:** Reference for porting server bot logic to client-side
botBrain.ts in M2 of the vs-bot implementation plan.

---

## 1. `buildBotCommits` — full extracted logic

### Verbatim source (socketHandlers.ts:314–331)

```typescript
/** בוט משתמש לכל היותר בקלף פעולה/ג'וקר אחד במשבצת 0 */
function buildBotCommits(state: ServerGameState): EquationCommitPayload[] {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const operationCard = hand.find((card) => card.type === 'operation');
  if (operationCard) {
    return [{ cardId: operationCard.id, position: 0, jokerAs: null }];
  }
  const jokerCard = hand.find((card) => card.type === 'joker');
  if (jokerCard) {
    return [
      {
        cardId: jokerCard.id,
        position: 0,
        jokerAs: state.hostGameSettings.enabledOperators?.[0] ?? '+',
      },
    ];
  }
  return [];
}
```

### Plain-English description

`buildBotCommits` returns at most one `EquationCommitPayload` — a commitment to place a
card in the equation's operator slot (position 0).

1. It scans the current player's hand for the **first** card with `type === 'operation'`.
   If found, it returns `[{ cardId, position: 0, jokerAs: null }]`.
2. If no operation card exists, it looks for the **first** `type === 'joker'` card.
   If found, it returns `[{ cardId, position: 0, jokerAs: enabledOperators[0] ?? '+' }]`,
   resolving the joker as the first enabled operator defined in `hostGameSettings` (or `'+'`
   as a hard fallback when the array is absent/empty).
3. If neither card type is in hand, it returns `[]` (no operator commit).

### Edge cases

| Scenario | Behaviour |
|---|---|
| No operation card, no joker | Returns `[]` — the equation proceeds with no explicit operator commit; the engine uses whatever default equation is already set. |
| Only a joker, `enabledOperators` is `undefined` or `[]` | `jokerAs` is assigned `'+'` via `?? '+'`. |
| Multiple operation cards in hand | Only the **first** one found (array iteration order) is used. |
| Multiple joker cards (no operation) | Only the **first** joker is used. |
| Operation card present AND joker present | Operation card wins — the `if (operationCard)` branch returns early before the joker branch is reached. |

---

## 2. `buildBotStagedPlan` — full extracted logic

### Verbatim source (socketHandlers.ts:333–384)

```typescript
function buildBotStagedPlan(state: ServerGameState): {
  target: number;
  equationDisplay: string;
  stagedCards: Card[];
  equationCommits: EquationCommitPayload[];
} | null {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const candidates = hand.filter((card) => card.type === 'number' || card.type === 'wild');
  const equationCommits = buildBotCommits(state);

  let bestPlan: {
    target: number;
    equationDisplay: string;
    stagedCards: Card[];
    equationCommits: EquationCommitPayload[];
    score: number;
  } | null = null;

  const totalMasks = 1 << candidates.length;
  for (const option of state.validTargets) {
    for (let mask = 1; mask < totalMasks; mask++) {
      const stagedCards: Card[] = [];
      let wildCount = 0;
      for (let index = 0; index < candidates.length; index++) {
        if ((mask & (1 << index)) === 0) continue;
        const card = candidates[index];
        if (card.type === 'wild') wildCount++;
        stagedCards.push(card);
      }
      if (wildCount > 1) continue;
      if (!validateStagedCards(stagedCards, null, option.result, state.hostGameSettings?.mathRangeMax ?? 25)) continue;
      const score = stagedCards.length + equationCommits.length;
      if (!bestPlan || score > bestPlan.score) {
        bestPlan = {
          target: option.result,
          equationDisplay: option.equation,
          stagedCards,
          equationCommits,
          score,
        };
      }
    }
  }

  if (!bestPlan) return null;
  return {
    target: bestPlan.target,
    equationDisplay: bestPlan.equationDisplay,
    stagedCards: bestPlan.stagedCards,
    equationCommits: bestPlan.equationCommits,
  };
}
```

### Algorithm walkthrough (step by step)

1. **Filter candidates**: From the bot's hand, keep only `number` and `wild` cards.
   Operation/joker/fraction cards are excluded from `candidates` entirely.
2. **Build operator commits**: Call `buildBotCommits(state)` once to get the (0 or 1)
   operator commit payload.
3. **Enumerate all non-empty subsets** via bitmask: `totalMasks = 1 << candidates.length`.
   Loop `mask` from `1` (at least one card) to `totalMasks - 1` (all cards).
4. **For each `(validTarget, mask)` pair**:
   a. Build `stagedCards[]` from the bits set in `mask`.
   b. Count wild cards in the subset (`wildCount`).
   c. **Skip** if `wildCount > 1` (at most one wild is allowed per staging).
   d. Call `validateStagedCards(stagedCards, null, option.result, mathRangeMax ?? 25)`.
      If this returns false, skip.
   e. Compute `score = stagedCards.length + equationCommits.length`.
   f. If `score > bestPlan.score`, replace `bestPlan`.
5. Return the best plan found, or `null`.

**Confirmed**: The description above is correct per the code.

### Tie-breaking rule

The condition is `score > bestPlan.score` (strictly greater than). If two plans have equal
score, the **first one encountered wins** (last-seen does NOT replace). Iteration order is
outer loop `validTargets` index → inner loop `mask` (ascending). So the first
`(validTarget, mask)` pair that achieves the highest score is kept.

### Determinism

Given the same `state` (same `validTargets` array order, same `hand` array order), the
planner is **fully deterministic** — no random selection is used.

### Overflow concern with `1 << candidates.length`

JavaScript bitwise operators operate on 32-bit signed integers. The maximum safe shift is
`1 << 30` (1 073 741 824 iterations). The standard hand size is 10 cards; with 10 candidates
that is `1 << 10 = 1024` iterations — far below any overflow threshold. Even at 30 candidates
(an extreme case), this would still be within 32-bit range, though the loop would be slow.
In practice, with a max hand size around 10, there is **no overflow concern**.

### `wildCount > 1` restriction

The check `if (wildCount > 1) continue` enforces that **at most one wild card** may be
staged per equation solve. This reflects the game rule that only one wild can be interpreted
as a free number in a single staged solution.

### Role of `validateStagedCards`

`validateStagedCards(stagedCards, null, option.result, mathRangeMax)` is the shared
validator that checks whether the given set of number/wild cards can sum/combine to reach
`option.result` within the allowed math range. It returns `true` only if the combination
is valid.

**Operation cards are never included in `stagedCards`** — they are exclusively in
`equationCommits`. The `candidates` filter (`type === 'number' || type === 'wild'`) ensures
this. The `null` second argument is the operation (it is resolved separately via the
`equationCommits`).

---

## 3. `handleBotDefense` — full extracted logic

### Verbatim source (socketHandlers.ts:386–408)

```typescript
function handleBotDefense(io: IOServer, room: Room, state: ServerGameState): void {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const divisibleCard = hand.find((card) => card.type === 'number' && (card.value ?? 0) > 0 && (card.value ?? 0) % state.fractionPenalty === 0);
  if (divisibleCard) {
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, divisibleCard.id));
    return;
  }

  const wildCard = hand.find((card) => card.type === 'wild');
  if (wildCard) {
    const wildResolve = Math.max(state.fractionPenalty, 1);
    applyBotState(io, room, (currentState) => defendFractionSolve(currentState, wildCard.id, wildResolve));
    return;
  }

  const counterFraction = hand.find((card) => card.type === 'fraction');
  if (counterFraction) {
    applyBotState(io, room, (currentState) => playFraction(currentState, counterFraction.id));
    return;
  }

  applyBotState(io, room, (currentState) => defendFractionPenalty(currentState));
}
```

### Priority order (confirmed)

1. **Divisible number card**: Find the first `type === 'number'` card whose value is
   positive AND divisible by `state.fractionPenalty`. Call `defendFractionSolve` with no
   `wildResolve`.
2. **Wild card**: Find the first `type === 'wild'` card. Call `defendFractionSolve` with
   `wildResolve = Math.max(state.fractionPenalty, 1)`.
3. **Counter-fraction**: Find the first `type === 'fraction'` card. Call `playFraction`
   to pass the fraction attack to the next player (block mode).
4. **Penalty**: No usable card found — call `defendFractionPenalty` (accept the penalty).

### `wildResolve` calculation (exact line)

```typescript
const wildResolve = Math.max(state.fractionPenalty, 1);
```

This resolves the wild card as the `fractionPenalty` value itself (minimum 1), so the wild
acts as exactly the number needed to be divisible by the penalty denominator.

### If no card can defend

`applyBotState(io, room, (currentState) => defendFractionPenalty(currentState))` is called.
The bot takes the fraction penalty — it draws cards equal to the penalty and the fraction
attack is resolved.

---

## 4. `handleBotPreRoll` — full extracted logic

### Verbatim source (socketHandlers.ts:410–427)

```typescript
function handleBotPreRoll(io: IOServer, room: Room, state: ServerGameState): void {
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const identicalCard = hand.find((card) => validateIdenticalPlay(card, topDiscard));
  if (identicalCard) {
    applyBotState(io, room, (currentState) => playIdentical(currentState, identicalCard.id));
    return;
  }

  const attackFraction = hand.find((card) => card.type === 'fraction' && validateFractionPlay(card, topDiscard));
  if (attackFraction) {
    applyBotState(io, room, (currentState) => playFraction(currentState, attackFraction.id));
    return;
  }

  applyBotState(io, room, (currentState) => doRollDice(currentState));
}
```

### Priority order (confirmed)

1. **Identical-playable card**: Find first card where `validateIdenticalPlay(card, topDiscard)`
   returns true. If found, play it via `playIdentical`.
2. **Attack fraction**: Find first `type === 'fraction'` card where
   `validateFractionPlay(card, topDiscard)` returns true. If found, play it via `playFraction`
   (attack mode — sets `pendingFractionTarget` on next player).
3. **Roll dice**: No special play available — call `doRollDice`.

### Validators used

- **Identical play**: `validateIdenticalPlay(card, topDiscard)` — imported from `./equations`.
  Checks if the card matches the top discard for an identical play.
- **Attack fraction**: `validateFractionPlay(card, topDiscard)` — also from `./equations`.
  Checks if the fraction card can be played on top of the current discard.

### Does the bot ever skip rolling dice?

The bot skips `doRollDice` only when it successfully plays an identical card or an attack
fraction (both branches `return` early). If both `applyBotState` calls in those branches
fail (return false), the function returns without rolling — effectively a no-op for that
step. The `scheduleBotAction` call in `runBotStep` will then schedule another attempt.

In normal flow the bot always reaches `doRollDice` if no special card is played.

---

## 5. `handleBotBuilding` — full extracted logic

### Verbatim source (socketHandlers.ts:429–459)

```typescript
function handleBotBuilding(io: IOServer, room: Room, state: ServerGameState): void {
  const plan = buildBotStagedPlan(state);
  if (!plan) {
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  const equationOk = applyBotState(io, room, (currentState) =>
    confirmEquation(currentState, plan.target, plan.equationDisplay, plan.equationCommits),
  );
  if (!equationOk || !room.state) {
    applyBotState(io, room, (currentState) => drawCard(currentState));
    return;
  }

  for (const stagedCard of plan.stagedCards) {
    const stagedOk = applyBotState(io, room, (currentState) => stageCard(currentState, stagedCard.id));
    if (!stagedOk) {
      applyBotState(io, room, (currentState) => drawCard(currentState));
      return;
    }
  }

  const confirmed = applyBotState(io, room, (currentState) => confirmStaged(currentState));
  if (!confirmed) {
    for (const stagedCard of plan.stagedCards) {
      applyBotState(io, room, (currentState) => unstageCard(currentState, stagedCard.id));
    }
    applyBotState(io, room, (currentState) => drawCard(currentState));
  }
}
```

### Flow (confirmed)

1. Call `buildBotStagedPlan(state)` once at the start.
2. If `plan` is `null` → `drawCard` and return.
3. Call `confirmEquation(currentState, plan.target, plan.equationDisplay, plan.equationCommits)`.
4. If `confirmEquation` fails → `drawCard` and return.
5. Loop over `plan.stagedCards` and call `stageCard` for each.
6. If any `stageCard` fails → `drawCard` and return (without unstaging already staged cards
   — see critical note below).
7. Call `confirmStaged`.
8. If `confirmStaged` fails → loop `unstageCard` for each card in `plan.stagedCards`,
   then `drawCard`.

### Critical question: is the plan re-computed between `stageCard` calls?

**No.** The plan is computed **exactly once** at line `const plan = buildBotStagedPlan(state)`
before any `applyBotState` call. The `for` loop iterates over `plan.stagedCards` (the
pre-computed array). Each `applyBotState` call passes `currentState` (the live room state)
but the **card IDs** staged come from the frozen `plan` object. The plan is not re-evaluated
mid-execution.

The sequence of `applyBotState` calls is:
1. `confirmEquation` (uses `plan.target`, `plan.equationDisplay`, `plan.equationCommits`)
2. `stageCard(currentState, stagedCard.id)` — one call per card in `plan.stagedCards`
3. `confirmStaged(currentState)`

### What happens if `confirmEquation` fails?

`equationOk` is `false`. The code immediately calls `drawCard` and returns. The bot draws
a card instead of solving.

### What happens if `stageCard` fails mid-loop?

`stagedOk` is `false`. The code calls `drawCard` and returns **without unstaging the cards
that were already successfully staged in previous loop iterations**. This appears to be a
minor bug or accepted simplification: already-staged cards are left staged, but the engine's
`drawCard` implementation (or subsequent engine cleanup) may handle this. Compare with the
`confirmStaged` failure path which does explicitly call `unstageCard`.

### What happens if `confirmStaged` fails?

`confirmed` is `false`. The code:
1. Loops over `plan.stagedCards` and calls `unstageCard` for each (cleanup).
2. Calls `drawCard`.

---

## 6. `runBotStep` and `scheduleBotAction` — scheduling logic

### Verbatim source (socketHandlers.ts:461–496)

```typescript
function runBotStep(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  switch (room.state.phase) {
    case 'turn-transition':
      applyBotState(io, room, (state) => beginTurn(state));
      break;
    case 'pre-roll':
      if (room.state.pendingFractionTarget !== null) handleBotDefense(io, room, room.state);
      else handleBotPreRoll(io, room, room.state);
      break;
    case 'building':
      handleBotBuilding(io, room, room.state);
      break;
    case 'solved':
      applyBotState(io, room, (state) => doEndTurn(state));
      break;
    default:
      break;
  }

  scheduleBotAction(io, room);
}

function scheduleBotAction(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  const delay = 900 + Math.floor(Math.random() * 700);
  room.botActionTimer = setTimeout(() => runBotStep(io, room), delay);
}
```

### Delay range

```typescript
const delay = 900 + Math.floor(Math.random() * 700);
```

Range: **900 ms to 1599 ms** (inclusive). The random component adds 0–699 ms on top of
the 900 ms base.

### Triggers and stop conditions

**`runBotStep` stops (returns early) when:**
- `room.state` is falsy
- `room.state.phase === 'game-over'`
- `currentPlayer(room)` is falsy, not a bot (`!player.isBot`), is eliminated, or is a spectator

**`scheduleBotAction` schedules the next step** at the end of `runBotStep` (after executing
the action). It also stops under the same conditions listed above.

The bot loop is therefore self-sustaining: each `runBotStep` call schedules the next one
via `scheduleBotAction`, until a stop condition is met.

### `switch (room.state.phase)` — all cases

| Phase | Action |
|---|---|
| `'turn-transition'` | `applyBotState(... beginTurn(state))` |
| `'pre-roll'` with `pendingFractionTarget !== null` | `handleBotDefense(io, room, room.state)` |
| `'pre-roll'` with `pendingFractionTarget === null` | `handleBotPreRoll(io, room, room.state)` |
| `'building'` | `handleBotBuilding(io, room, room.state)` |
| `'solved'` | `applyBotState(... doEndTurn(state))` |
| any other phase (`default`) | no-op (`break`) |

---

## 7. `applyBotState` — state mutation wrapper

### Verbatim source (socketHandlers.ts:267–293)

```typescript
function applyBotState(
  io: IOServer,
  room: Room,
  actionFn: (state: ServerGameState) => ServerGameState | { error: LocalizedMessage },
): boolean {
  if (!room.state) return false;
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
  }

  const result = actionFn(room.state);
  if ('error' in result) return false;

  const prevSig = lastMoveSignature(room.state.lastMoveMessage);
  room.state = withOnlineTurnDeadline(result);
  room.lastActivity = Date.now();
  if (lastMoveSignature(room.state.lastMoveMessage) !== prevSig && room.state.lastMoveMessage) {
    emitRoomToasts(io, room);
  }
  broadcastState(io, room);
  if (room.state.identicalCelebration) {
    room.state = { ...room.state, identicalCelebration: null };
    broadcastState(io, room);
  }
  scheduleRoomTurnTimer(io, room);
  return true;
}
```

### On success vs. error

- **Success** (`result` has no `error` property): Updates `room.state` to
  `withOnlineTurnDeadline(result)`, updates `room.lastActivity`, emits toasts if the last
  move message changed, broadcasts the new state to all clients, clears any
  `identicalCelebration` flag (with a second broadcast), reschedules the turn timer.
  Returns `true`.
- **Error** (`'error' in result`): Does **not** mutate `room.state`. Returns `false`.

### Server-only concerns (not needed in client bot brain)

| Server concern | What it does | Why client doesn't need it |
|---|---|---|
| `withOnlineTurnDeadline(result)` | Stamps a server-side deadline onto the state for the turn timer | Client state has no turn deadline field |
| `emitRoomToasts(io, room)` | Sends toast notifications over Socket.IO to all room members | Client handles toasts locally via its own reducer |
| `broadcastState(io, room)` | Emits the full new state to all connected clients | Client state is local; no broadcast needed |
| `scheduleRoomTurnTimer(io, room)` | Schedules server-side auto-end-turn if the human doesn't act in time | Client turn timer is separate UI concern |
| `room.lastActivity = Date.now()` | Keeps the room alive (prevents idle cleanup) | No room management on client |

The client bot brain only needs to call the pure engine functions and apply their return
value to local state — no I/O side-effects.

---

## 8. Engine function signatures (from gameEngine.ts)

All functions are exported from `card/server/src/gameEngine.ts`.

```typescript
export function beginTurn(st: ServerGameState): ServerGameState
```
Return type: `ServerGameState` (never errors).

```typescript
export function doRollDice(st: ServerGameState): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function playIdentical(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function playFraction(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function confirmEquation(
  st: ServerGameState,
  result: number,
  equationDisplay: string,
  equationCommits?: EquationCommitPayload[] | null,
  /** @deprecated use equationCommits */
  equationCommit?: EquationCommitPayload | null,
): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.
Note: `equationCommit` (singular, 5th param) is deprecated; use `equationCommits` (plural, 4th param).

```typescript
export function stageCard(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function unstageCard(st: ServerGameState, cardId: string): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function confirmStaged(st: ServerGameState): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function drawCard(st: ServerGameState): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

```typescript
export function doEndTurn(st: ServerGameState): ServerGameState
```
Return type: `ServerGameState` (never errors — if the player hasn't acted, it draws a
penalty card on their behalf before ending the turn).

```typescript
export function defendFractionSolve(st: ServerGameState, cardId: string, wildResolve?: number): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.
`wildResolve` is optional — only pass it when defending with a wild card.

```typescript
export function defendFractionPenalty(st: ServerGameState): ServerGameState | { error: LocalizedMessage }
```
Return type: `ServerGameState | { error: LocalizedMessage }`.

---

## 9. `HostGameSettings` shape (from shared/types.ts)

```typescript
/** הגדרות שמשתמש המארח קובע בתחילת משחק — משודרות לכל לקוח ב־PlayerView */
export interface HostGameSettings {
  /** תמיד 3 קוביות — אפשרות 2 הוסרה מהמוצר */
  diceMode: '3';
  showFractions: boolean;
  showPossibleResults: boolean;
  showSolveExercise: boolean;
  mathRangeMax?: 12 | 25;
  enabledOperators?: Operation[];
  allowNegativeTargets?: boolean;
  difficultyStage?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  abVariant?: 'control_0_12_plus' | 'variant_0_15_plus';
  timerSetting: '30' | '60' | 'off' | 'custom';
  timerCustomSeconds: number;
}
```

Fields relevant to the bot brain:

| Field | Bot usage |
|---|---|
| `enabledOperators` | Used in `buildBotCommits` — joker resolves as `enabledOperators[0] ?? '+'` |
| `mathRangeMax` | Used in `buildBotStagedPlan` — passed to `validateStagedCards` as upper bound; defaults to `25` if absent |

All other fields (`diceMode`, `showFractions`, etc.) are UI/display settings not read by
the bot logic.

---

## 10. Local-vs-server rule drift specific to the bot

### Server `playFraction` — attack mode `newTarget` computation

From `gameEngine.ts:566–574` (attack mode, non-defense branch):

```typescript
  // ── ATTACK MODE: fraction on a number card ──
  if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') {
    return locErr('fraction.cannotPlayPhase');
  }
  const td = st.discardPile[st.discardPile.length - 1];
  if (!validateFractionPlay(card, td)) return locErr('fraction.cannotPlayOnTop');
  const effTop = getEffectiveNumber(td);
  if (effTop === null) return locErr('fraction.cannotPlayOnTop');
  const newTarget = effTop / denom;
```

The exact computation is:

```typescript
const newTarget = effTop / denom;
```

Where:
- `effTop = getEffectiveNumber(td)` — the effective numeric value of the **top discard card**
  (resolving special cards as needed).
- `denom = fractionDenominator(card.fraction!)` — the denominator of the fraction card being
  played (e.g., for `1/2` the denominator is `2`).

### What this means for the bot

When the bot plays an attack fraction, the **defender's `pendingFractionTarget`** is set to:

```
pendingFractionTarget = effectiveValueOfTopDiscard / fractionDenominator
```

For example, if the top of the discard pile shows a `6` and the bot plays a `1/2` fraction
card, the next player must defend against a target of `6 / 2 = 3`. The defending player
must play a card with value `3` (or a multiple of `3` if they want to divide further, using
`fractionPenalty`).

This is important for the client bot brain: when porting the attack-fraction logic, the
client must read the **discard pile top card's effective number**, not any other value, as
the base for the fraction computation.

**The defense branch** (`pendingFractionTarget !== null`) also computes a new target:

```typescript
const newTarget = st.pendingFractionTarget / denom;
```

i.e., it further divides the already-pending target — fraction-on-fraction chaining is
supported.

---

## Findings — Discrepancies and noteworthy items

### FLAG: `stageCard` mid-loop failure does NOT unstage

In `handleBotBuilding`, if `stageCard` fails mid-loop, the code calls `drawCard` and
returns **without calling `unstageCard` for cards already staged in previous iterations**.
Compare with the `confirmStaged` failure path which correctly calls `unstageCard` for all
`plan.stagedCards`. This asymmetry could leave orphan staged cards in the room state after
a mid-loop `stageCard` failure.

The client bot brain port should decide whether to replicate this behavior or fix it
(call `unstageCard` on all previously staged cards before `drawCard`).

### NOTE: `buildBotStagedPlan` scores only by card count, not by strategic value

The scoring formula `stagedCards.length + equationCommits.length` maximizes the number of
cards discarded from hand. There is no prioritization by target value, no preference for
specific operators, and no lookahead. This is a greedy count-maximizing strategy.

### NOTE: Bot always attacks with first fraction card found

`handleBotPreRoll` plays the first matching fraction card it finds. It does not evaluate
whether attacking is strategically beneficial (e.g., considering the defender's hand size).

### NOTE: `buildBotCommits` only fills position 0

The bot's equation commits are limited to a single card at operator position 0. This is
consistent with standard play but means the bot never places multiple operator cards
(if that were ever game-legal).

### NOTE: Joker operator fallback chain

`enabledOperators?.[0] ?? '+'` means: if `enabledOperators` is `undefined`, `null`, or
an empty array, the joker resolves as `'+'`. An empty array would cause `[0]` to return
`undefined`, then fall through to `'+'`. This is safe but subtly different from "use the
first enabled operator" — with an empty array it silently defaults to addition.
