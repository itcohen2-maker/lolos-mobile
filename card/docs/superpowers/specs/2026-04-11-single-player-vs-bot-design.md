# Single-Player vs Bot — Design Spec

**Status:** AMENDED 2026-04-11 — research addendum in §0 supersedes §1, §4 decisions 1–3, §5, §6, §9. See §0 for the authoritative design.
**Date:** 2026-04-11
**Author:** Claude (brainstorming session with tom cohen)
**Scope:** Add a "Play vs Bot" option to the single-player flow. Original scope (engine unification) descoped after codebase research; see §0.

---

## 0. Research Addendum (2026-04-11, AUTHORITATIVE)

This section was added after a codebase research pass revealed that the original problem statement in §1 was built on a wrong model of the codebase. Where §0 and later sections conflict, **§0 wins**. The later sections remain in the document as historical context and to preserve the decision log (§4, decisions 4–7), which is still valid.

### 0.1 What I found

**The app's real entry point is `card/index.tsx` (9,600+ lines).** `package.json` has `"main": "index.tsx"`. Everything under `src/components/`, `src/context/`, and `src/hooks/` that I inspected in the original spec research is **dead code** — orphaned older copies that `index.tsx` does not import. The only file under `src/components/` that `index.tsx` imports is `SoundDemoScreen.tsx`. Likewise, `card/App.tsx`, `card/GameScreen.tsx` (the top-level 76KB one), `card/Dice3D.tsx`, and `card/AnimatedDice.tsx` are also not imported by `index.tsx` — older backups.

**`index.tsx` defines everything inline:**

| Symbol | Line in `index.tsx` |
|---|---|
| `gameReducer` | 934 |
| `GameContext` | 1507 |
| `GameProvider` | 1508 |
| `useGame` | 1643 |
| `DrawPile` | 2308 |
| `DiscardPile` | 2341 |
| `ActionBar` | 3592 |
| `PlayerHand` | 4079 |
| `StartScreen` | 4643 |
| `TurnTransition` | 6523 |
| `GameScreen` | 7324 |
| `GameOver` | 8612 |
| App render tree (play-mode router) | 9210–9256 |

**The local reducer already speaks the new-engine vocabulary.** `index.tsx`'s `gameReducer` uses the same phase names as the server engine (`turn-transition`, `pre-roll`, `building`, `solved`, `game-over`) and the same action verbs (`START_GAME`, `BEGIN_TURN`, `ROLL_DICE`, `CONFIRM_EQUATION`, `STAGE_CARD`, `CONFIRM_STAGED`, `PLAY_IDENTICAL`, `PLAY_FRACTION`, `DEFEND_FRACTION_SOLVE`, `DEFEND_FRACTION_PENALTY`, `DRAW_CARD`, `END_TURN`). The stage/commit flow already exists in the local game. Fraction defense already exists in the local game. `validTargets` already exists.

**`GameProvider` already unifies local + online state.** Lines 1508–1642 implement a state provider that reads either from the local reducer (offline) or from a multiplayer `override` (online `PlayerView`), with client-only overlays for notifications, sound prefs, and the joker modal. `dispatch` routes actions to the local reducer offline and to `override.dispatch` (socket) online. This was the UI-layer architectural goal of the original B2 scope — it's already done.

**But the local reducer and the server engine are NOT the same engine.** They have parallel, drifted implementations of the same rules:

- `PLAY_FRACTION` attack math differs: server computes `newTarget = topOfDiscard / denom` (attacks the pile-top value); local computes `newTarget = denom` (standalone target).
- `index.tsx`'s state shape has extra fields not in `ServerGameState`: `moveHistory`, `equationOpsUsed`, `challengeSource`, `activeFraction`, `lastDiscardCount`, `selectedCards`, `equationHandSlots`, `equationHandPick`, `notifications`, guidance/sound prefs, plus several more.
- The two files use parallel i18n namespaces: local uses `local.*` keys, server uses `toast.*` / `msg.*`.
- `shared/i18n/he.ts:353` has a comment *"Legacy src/context/GameContext (simplified ruleset)"* confirming that the `src/context/GameContext.tsx` file is intentionally legacy dead code, predating the inline `gameReducer` in `index.tsx`.

**`index.tsx` has zero bot logic.** Confirmed by exhaustive grep — no `isBot`, `botBrain`, `runBot`, `makeBot`, or variants. All bot code lives in `server/src/socketHandlers.ts` and never crosses into the client.

### 0.2 Revised goal

Add a "Play vs Bot" entry point to the single-player flow inside `index.tsx`, with Easy/Hard bot difficulty. Minimal footprint: port the server bot's *decision logic* into a new client-side brain targeting the local reducer's action vocabulary. Do not touch the server. Do not attempt to unify the local and server reducers — that divergence is a pre-existing code smell unrelated to this feature and deserves its own project.

Decision made during research (R1 of R1/R2/R3): proceed with minimal bot add-on. Engine unification is explicitly **deferred** and should be captured as a separate design spec if pursued.

### 0.3 Revised architecture

```
card/
├── index.tsx                                 ← live app (9600+ lines)
│   ├── gameReducer (line 934)                ← untouched except for bot cases
│   ├── GameProvider (line 1508)              ← add bot clock useEffect
│   ├── StartScreen (line 4643)               ← add mode toggle, bot diff toggle,
│   │                                            advanced disclosure, vs-bot start path
│   └── (all other inline screens)            ← untouched
│
├── src/bot/                                  ← NEW directory
│   ├── botBrain.ts                           ← decideBotAction(state, difficulty): BotAction | null
│   ├── executor.ts                           ← executeBotAction(state, action, dispatch): void
│   │                                            dispatches against local reducer's action vocab
│   └── types.ts                              ← BotDifficulty, BotAction union
│
├── server/                                   ← UNTOUCHED
│   └── src/gameEngine.ts, socketHandlers.ts  ← unchanged; existing server bot keeps working
│
├── shared/                                   ← UNTOUCHED
│   └── types.ts, i18n/, gameConstants.ts     ← unchanged
│
└── src/context/GameContext.tsx               ← DEAD; leave on disk, flag as dead in a comment
    src/hooks/useGame.ts                      ← DEAD
    src/components/screens/*                  ← DEAD (except SoundDemoScreen)
    src/components/board/*                    ← DEAD
    src/components/ui/*                       ← DEAD (except anything index.tsx actually imports; verify)
    src/components/cards/*                    ← DEAD
    App.tsx, GameScreen.tsx (root),           ← DEAD
    Dice3D.tsx, AnimatedDice.tsx
```

Cleanup of dead code is **explicitly out of scope** for this feature. It's a separate mechanical task with zero functional impact and should not be bundled with a feature PR.

### 0.4 Revised state additions

Added to the local `GameState` type inside `index.tsx` (existing interface, new fields):

```typescript
// Added fields — at the end of the existing GameState interface:
botDifficulty: BotDifficulty | null;   // null = no bots in this game
botPlayerIds: readonly string[];        // player IDs for bot players; empty = pass-and-play
```

Added to the existing `Player` type inside `index.tsx`:

```typescript
isBot: boolean;   // defaults false; set true for bot players in START_GAME
```

(If `Player` already has an `isBot` field inside `index.tsx`, we reuse it as-is. To be verified during Task 1 of the plan.)

Added to the `GameAction` union inside `index.tsx`:

```typescript
| { type: 'START_GAME';                    // EXISTING — amended signature
    players: Array<{ name: string; isBot: boolean }>;
    difficulty: 'easy' | 'full';
    mode: 'pass-and-play' | 'vs-bot';
    botDifficulty?: BotDifficulty;
    hostGameSettings?: Partial<HostGameSettings>;
  }
| { type: 'BOT_STEP' }                     // NEW — fired by bot clock
```

The existing `START_GAME` handler is amended minimally to:
1. Pass `isBot: player.isBot` through when constructing the initial `players` array.
2. Store `botDifficulty ?? null` and derive `botPlayerIds` from `players.filter(p => p.isBot).map(p => p.id)`.
3. Leave all existing behavior (deck generation, card dealing, discard seeding, guidance turns, etc.) untouched.

### 0.5 Revised bot clock

Identical to the bot clock from the original §5.4, with one adjustment: it dispatches `BOT_STEP` into `index.tsx`'s reducer, and the reducer handles `BOT_STEP` by calling `decideBotAction(state, state.botDifficulty)` and then executing the resulting action via **a direct reducer-level transformation** rather than through another dispatch. This avoids a double-dispatch cycle within a single React render pass.

```typescript
// Inside index.tsx's gameReducer:
case 'BOT_STEP': {
  if (st.phase === 'game-over') return st;
  const current = st.players[st.currentPlayerIndex];
  if (!current || !st.botPlayerIds.includes(current.id)) return st;
  const action = decideBotAction(st, st.botDifficulty ?? 'hard');
  if (!action) return st;
  // Translate BotAction into the existing reducer action and recursively reduce:
  const translated = translateBotAction(action);
  if (!translated) return st;
  return gameReducer(st, translated, tf);
}
```

`translateBotAction(action: BotAction): GameAction | null` is a small pure function in `src/bot/executor.ts` that maps the bot's `BotAction` union onto the existing local reducer's action vocabulary. It's the shim between the new bot types and the old reducer verbs.

### 0.6 Revised bot action translation

The bot brain is platform-agnostic: it returns a `BotAction` (§5.5 of the original spec, unchanged). The `translateBotAction` shim maps each `BotAction` kind to an existing `GameAction`:

| BotAction | Translated to local GameAction |
|---|---|
| `{ kind: 'beginTurn' }` | `{ type: 'BEGIN_TURN' }` |
| `{ kind: 'rollDice' }` | `{ type: 'ROLL_DICE' }` |
| `{ kind: 'playIdentical', cardId }` | `{ type: 'PLAY_IDENTICAL', card: findCard(cardId) }` |
| `{ kind: 'playFractionAttack', cardId }` | `{ type: 'PLAY_FRACTION', card: findCard(cardId) }` |
| `{ kind: 'playFractionBlock', cardId }` | `{ type: 'PLAY_FRACTION', card: findCard(cardId) }` |
| `{ kind: 'confirmEquation', target, equationDisplay, equationCommits }` | `{ type: 'CONFIRM_EQUATION', equationResult: target, equationDisplay, equationCommits }` (exact field names TBD during Task 2; reducer's existing signature is the source of truth) |
| `{ kind: 'stageCard', cardId }` | `{ type: 'STAGE_CARD', cardId }` |
| `{ kind: 'unstageCard', cardId }` | `{ type: 'UNSTAGE_CARD', cardId }` (verify name exists in reducer) |
| `{ kind: 'confirmStaged' }` | `{ type: 'CONFIRM_STAGED' }` |
| `{ kind: 'drawCard' }` | `{ type: 'DRAW_CARD' }` |
| `{ kind: 'endTurn' }` | `{ type: 'END_TURN' }` |
| `{ kind: 'defendFractionSolve', cardId, wildResolve? }` | `{ type: 'DEFEND_FRACTION_SOLVE', card: findCard(cardId), wildResolve }` |
| `{ kind: 'defendFractionPenalty' }` | `{ type: 'DEFEND_FRACTION_PENALTY' }` |

The exact field names in each translated action must match the existing `GameAction` union in `index.tsx`. Task 1 of the implementation plan is to read and document that union so Task 2 (writing the translator) has a ground-truth reference.

**`PLAY_FRACTION` note:** because `index.tsx`'s `PLAY_FRACTION` attack rule differs from the server engine's (newTarget = denom vs. newTarget = topOfDiscard / denom), the bot's attack-fraction heuristic must be retargeted to the local rule. Specifically, `handleBotPreRoll`'s "play an attack fraction if `validateFractionPlay(card, topDiscard)` returns true" check uses a shared validator. If that validator also lives in `index.tsx` inline (not imported from `shared/`), the bot must use the local validator, not the one imported from `server/` or `shared/`. This is verified in Task 1.

### 0.7 Revised i18n

Same new keys as the original §6.5, but they go into `shared/i18n/en.ts` and `shared/i18n/he.ts` under a **new `botOffline.*` namespace** to avoid colliding with either `local.*` (existing inline-reducer keys) or `toast.*`/`msg.*` (server-bot keys). Namespacing them separately also makes it obvious to future readers which keys belong to this feature.

| Key | English | Hebrew |
|---|---|---|
| `botOffline.mode` | Mode | מצב |
| `botOffline.modePassAndPlay` | Pass and play | משחק מקומי |
| `botOffline.modeVsBot` | Play vs Bot | שחק מול בוט |
| `botOffline.botDifficulty` | Bot difficulty | רמת בוט |
| `botOffline.botEasy` | Easy | קל |
| `botOffline.botHard` | Hard | קשה |
| `botOffline.advancedSettings` | Advanced game settings | הגדרות מתקדמות |
| `botOffline.botName` | Bot | בוט |

### 0.8 Revised rollout

Seven milestones, each a mergeable commit.

| # | Milestone | Files touched | Gate |
|---|---|---|---|
| M1 | Survey `index.tsx` — document the existing `GameAction` union, `GameState`, `Player`, `Card`, `HostGameSettings`, and the inline `validateFractionPlay` / `validateIdenticalPlay` / `validateStagedCards` helpers. Write findings into `docs/superpowers/specs/2026-04-11-index-tsx-survey.md`. | None (read-only) | Survey doc exists and is accurate |
| M2 | Create `src/bot/types.ts` and `src/bot/botBrain.ts` — pure `decideBotAction(state, difficulty): BotAction \| null`. Uses the *local* `GameState` type imported from `index.tsx` (or a new `src/bot/state-types.ts` that re-exports what's needed). Profile 3 Easy = minimizer comparator in the planner. | `src/bot/types.ts`, `src/bot/botBrain.ts` | Unit tests pass (M3 gate) |
| M3 | Bot brain unit tests: `src/bot/__tests__/botBrain.test.ts`. Cover every phase transition from the decision table, plus the Profile 3 Easy vs Hard comparison. | `src/bot/__tests__/botBrain.test.ts`, plus whatever test runner config the project needs (Vitest/Jest; verify in M1) | All bot brain tests pass |
| M4 | Create `src/bot/executor.ts` — `translateBotAction(action): GameAction \| null` + `findCardInHand(state, cardId)`. Unit tests in `src/bot/__tests__/executor.test.ts`. | `src/bot/executor.ts`, `src/bot/__tests__/executor.test.ts` | Translator tests pass |
| M5 | Wire the bot into `index.tsx`: extend `GameState` with `botDifficulty` and `botPlayerIds`; extend `Player` with `isBot` (or confirm it exists); amend `START_GAME` handler; add `BOT_STEP` case; add bot clock `useEffect` in `GameProvider`. | `index.tsx` (targeted edits; no architectural changes) | App compiles; bot-mode game plays end-to-end manually; pass-and-play still works |
| M6 | `StartScreen` vs-bot entry point: mode toggle, bot difficulty toggle, advanced settings disclosure, vs-bot `START_GAME` dispatch. Add new `botOffline.*` i18n keys to `shared/i18n/en.ts` and `shared/i18n/he.ts`. | `index.tsx` (StartScreen region, line 4643 onward), `shared/i18n/en.ts`, `shared/i18n/he.ts` | Manual playthrough checklist passes |
| M7 | Verification pass: full manual checklist; inspect any bot-game edge cases discovered during M5–M6; confirm no regressions in pass-and-play or online. | None (verification only) | Checklist clean |

**Zero server changes. Zero online-multiplayer risk.** Milestones M1–M4 are pure additions to `src/bot/` and cannot break anything. M5–M6 edit `index.tsx` but only append new reducer cases, new state fields, and a new `StartScreen` section — no refactor of existing code.

### 0.9 Revised testing

Unchanged from §7.2 for bot brain unit tests. **§7.1 engine unit tests are dropped** — we are not touching the engine, so there is nothing new to test at the engine layer. The existing engine behavior is validated by the existing game working.

Manual playthrough checklist (before merging to main):

1. Offline single-player pass-and-play, 2 players: completes end-to-end. (Regresses M5 reducer edits.)
2. Offline single-player pass-and-play, 4 players: completes end-to-end.
3. Offline single-player vs bot, Easy: completes; bot visibly plays timidly; human wins most games.
4. Offline single-player vs bot, Hard: completes; bot plays aggressively; human loses some games.
5. Online-vs-bot game on Render: completes end-to-end. (Regression check — we didn't touch the server, but verify nothing downstream broke.)
6. Online multi-human (no bot): completes end-to-end.
7. Advanced settings panel: changing `enabledOperators`, `mathRangeMax`, and `timerSetting` each produces the expected in-game effect in single-player vs bot.

### 0.10 Decisions carried forward from the original spec

The following decisions from §4 remain valid and apply unchanged to the revised design:

- **Decision 4 (Easy + Hard):** Two bot difficulty levels.
- **Decision 5 (Profile 3):** Easy = minimizer comparator in `buildBotStagedPlan`. One-line difference from Hard.
- **Decision 6 (Option C — advanced disclosure):** StartScreen has defaults for casual players plus an "Advanced" disclosure for power users.
- **Decision 7 (useEffect bot clock):** Bot scheduling lives in `GameProvider` via a `useEffect` with a narrow dependency array.

The following decisions from §4 are **superseded by §0**:

- ~~**Decision 1 (Option B — offline bot in `GameContext`):**~~ The target is now `index.tsx`'s inline reducer, not `src/context/GameContext.tsx`.
- ~~**Decision 2 (Option A — move to `shared/`):**~~ No engine move. Bot lives in `src/bot/` and targets the local reducer directly.
- ~~**Decision 3 (A-full — delete old reducer):**~~ No reducer deletion. `index.tsx`'s reducer is the live reducer and stays intact.
- ~~**Decision 4a (rebuild GameScreen in place):**~~ No GameScreen rebuild. `index.tsx`'s inline `GameScreen` already speaks the new-engine vocabulary.
- ~~**Decision 4b (pass-and-play stays prominent):**~~ Still true, but for a simpler reason: we're not removing anything.

---

## 1. Problem

The single-player start screen (`src/components/screens/StartScreen.tsx`) offers pass-and-play only. The existing "vs Bot" functionality lives exclusively in the online multiplayer lobby (`src/screens/LobbyScreens.tsx`) and runs server-side; it requires an internet connection, a Render deploy, and a round-trip through the socket server. There is no offline / single-player way to play against a bot even though the bot logic already exists on the server.

Additionally, the local game in `src/context/GameContext.tsx` (517 lines) and the server game in `server/src/gameEngine.ts` (747 lines) are **different games** — different phases, different card types, different fraction-attack system, different equation flow, different settings model. This divergence is a pre-existing bug factory and is the real reason adding "vs bot" to single-player is non-trivial.

## 2. Goal

Single-player mode supports a "Play vs Bot" entry point on `StartScreen`, with an Easy/Hard bot difficulty selector and an advanced game-settings disclosure. The feature runs entirely offline in the client, with no socket server involved. The local game engine is unified with the server engine so there is a single source of truth for rules, and the existing server bot brain is reused without duplication.

## 3. Non-Goals

The following are intentionally deferred. Any of them becoming requirements changes the scope of this spec:

- Seedable RNG for deterministic bot testing.
- Bot hint / suggestion feature for human turns.
- Persisting the last-used bot difficulty between sessions.
- Multiple bots in one single-player game.
- Bot chat, personality, or taunts.
- Pause-on-background (React Native `AppState` integration).
- A-B-C game variant selection on `StartScreen`.
- Any new gameplay rules. This is a migration plus an entry point, not a rules change.

## 4. Decisions Log

Decisions made during the brainstorming session, in order, with the rejected alternatives:

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Offline bot vs online-reuse vs duplicate engine | **Option B — true offline bot in `GameContext`** | Works offline, no server dependency |
| 2 | Where does the shared engine live? | **A — move to `shared/`** | Pure TypeScript, runs identically in browser/RN and Node; two Node-only imports trivially replaceable |
| 3 | What happens to the old `GameContext` reducer? | **A-full — delete old reducer, rewire every screen** | One engine, one UI, long-term clean; rejected A-scoped because it perpetuates the duplication |
| 4 | How many bot difficulty levels? | **B — Easy + Hard** | Matches user expectation; rejected one-bot as too coarse and three-bot as diminishing returns |
| 5 | How does Easy play worse? | **Profile 3 — minimizer planner** | One-line change in `buildBotStagedPlan`; measurable; never produces "broken" behavior |
| 6 | Game settings exposure on `StartScreen` | **C — defaults + Advanced disclosure** | Casual users unaffected; power users have full control |
| 7 | Bot scheduling inside React | **A — `useEffect` clock in `GameContext`** | Matches server pattern exactly; bot brain stays pure |
| 4a | Delete local `GameScreen` or rebuild in place? | **Rebuild in place (P1)** | Preserves visual style; required by A-full |
| 4b | Pass-and-play status | **i — keep, prominent alongside vs-bot** | Both modes equal on `StartScreen` |

## 5. Architecture

### 5.1 File layout after migration

```
card/
├── shared/                              ← SINGLE source of truth
│   ├── gameEngine.ts                    ← moved from server/src/gameEngine.ts
│   ├── deck.ts                          ← moved from server/src/deck.ts
│   ├── equations.ts                     ← moved from server/src/equations.ts
│   ├── rng.ts                           ← NEW: JS-only replacement for node:crypto
│   ├── bot/
│   │   ├── botBrain.ts                  ← NEW: extracted from socketHandlers.ts:313–458
│   │   │                                   pure decideBotAction(state, difficulty): BotAction | null
│   │   ├── executor.ts                  ← NEW: executeBotAction(state, action) → state
│   │   └── types.ts                     ← NEW: BotDifficulty, BotAction union
│   └── (existing: types.ts, i18n/, gameConstants.ts)
│
├── server/src/
│   ├── gameEngine.ts                    ← DELETED (re-exports from shared if needed for compat)
│   ├── deck.ts                          ← DELETED
│   ├── equations.ts                     ← DELETED
│   ├── socketHandlers.ts                ← imports from shared/bot/
│   │                                      delete buildBotCommits, buildBotStagedPlan,
│   │                                      handleBotPreRoll, handleBotDefense, handleBotBuilding
│   │                                      (~140 lines removed)
│   │                                      keep runBotStep + scheduleBotAction as thin wrappers
│   │                                      around decideBotAction + executeBotAction
│   └── roomManager.ts                   ← unchanged
│
└── src/
    ├── context/
    │   └── GameContext.tsx              ← REWRITTEN as wrapper around shared/gameEngine
    │                                       - state = ClientGameState (extends ServerGameState)
    │                                       - new action vocabulary (see §5.3)
    │                                       - bot clock useEffect (see §5.4)
    ├── types/
    │   └── game.ts                      ← DELETED; screens import from shared/types
    └── components/screens/
        ├── StartScreen.tsx              ← mode toggle, bot-difficulty toggle, advanced panel
        ├── GameScreen.tsx               ← rebuilt card-play flow on new engine (P1)
        ├── TurnTransition.tsx           ← rewired to new phases
        ├── GameOver.tsx                 ← rewired
        └── (every other file that imported src/types/game or dispatched old actions)
```

### 5.2 Shared RNG (`shared/rng.ts`)

Replaces the two `node:crypto` imports in the engine. Uses `Math.random` and a simple UUID v4 generator. Not cryptographically secure — this is a card game, not a casino.

```typescript
export function randomInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo));
}

export function randomUUID(): string {
  // RFC4122 v4 using Math.random
  const hex = [...Array(36)].map((_, i) => {
    if (i === 8 || i === 13 || i === 18 || i === 23) return '-';
    if (i === 14) return '4';
    if (i === 19) return ((Math.random() * 4) | 8).toString(16);
    return ((Math.random() * 16) | 0).toString(16);
  });
  return hex.join('');
}
```

Both the server and the client import from this file. The server no longer uses `node:crypto` for game randomness — if deterministic testing is ever required, we swap this file for a seedable PRNG in one place.

### 5.3 Client game state and action vocabulary

`GameContext` owns `ClientGameState`:

```typescript
import type { ServerGameState } from '../../shared/types';
import type { BotDifficulty } from '../../shared/bot/types';

export interface ClientGameState extends ServerGameState {
  botDifficulty: BotDifficulty | null;   // null = pass-and-play, no bots
  botPlayerIds: readonly string[];       // computed at START_GAME from players[].isBot
}
```

Actions:

```typescript
type GameAction =
  | { type: 'START_GAME';
      mode: 'pass-and-play' | 'vs-bot';
      players: Array<{ name: string; isBot: boolean }>;
      difficulty: 'easy' | 'full';
      botDifficulty?: BotDifficulty;
      hostGameSettings: HostGameSettings;
    }
  | { type: 'PLAYER_ACTION'; action: EngineAction }   // all human moves
  | { type: 'BOT_STEP' }                              // fired by the clock
  | { type: 'RESET_GAME' };
```

`EngineAction` is a tagged union mirroring the `shared/gameEngine.ts` function signatures:

```typescript
type EngineAction =
  | { kind: 'beginTurn' }
  | { kind: 'rollDice' }
  | { kind: 'playIdentical'; cardId: string }
  | { kind: 'playFraction'; cardId: string }
  | { kind: 'confirmEquation'; result: number; equationDisplay: string;
      equationCommits: EquationCommitPayload[] }
  | { kind: 'stageCard'; cardId: string }
  | { kind: 'unstageCard'; cardId: string }
  | { kind: 'confirmStaged' }
  | { kind: 'drawCard' }
  | { kind: 'endTurn' }
  | { kind: 'defendFractionSolve'; cardId: string; wildResolve?: number }
  | { kind: 'defendFractionPenalty' };
```

The reducer is a thin dispatcher: `PLAYER_ACTION` and `BOT_STEP` both funnel into `executeBotAction`-style calls against the shared engine. Old action names (`PLAY_CARDS`, `CONFIRM_EQUATION { equationResult }`, `SELECT_CARD`, `PLAY_IDENTICAL`, `PLAY_OPERATION`, `PLAY_FRACTION`, `PLAY_JOKER`, `DRAW_CARD`, `END_TURN`, `NEXT_TURN`, `BEGIN_TURN`, `ROLL_DICE`, `OPEN_JOKER_MODAL`, `CLOSE_JOKER_MODAL`) are **deleted**.

**Note on `playFraction` vs. the bot's split `playFractionAttack` / `playFractionBlock`:** `EngineAction` has a single `playFraction` because the engine function `playFraction(state, cardId)` internally detects attack vs. block from `state.pendingFractionTarget`. The bot's `BotAction` union (§5.5) splits them for strategic clarity inside the brain, but the executor collapses both back into the same engine call. This split exists only to make bot decision logs readable; it has no gameplay effect.

### 5.4 Bot clock (`useEffect` in `GameProvider`)

```typescript
useEffect(() => {
  if (state.phase === 'game-over') return;
  const current = state.players[state.currentPlayerIndex];
  if (!current || !state.botPlayerIds.includes(current.id)) return;

  if (state.phase !== 'turn-transition'
      && state.phase !== 'pre-roll'
      && state.phase !== 'building'
      && state.phase !== 'solved') return;

  const delay = 900 + Math.floor(Math.random() * 700);
  const timer = setTimeout(() => dispatch({ type: 'BOT_STEP' }), delay);
  return () => clearTimeout(timer);
}, [
  state.phase,
  state.currentPlayerIndex,
  state.hasPlayedCards,
  state.stagedCards.length,
  state.equationResult,
  state.pendingFractionTarget,
  state.botPlayerIds,
  state.botDifficulty,
]);
```

**`BOT_STEP` reducer behavior:**

1. If `state.phase === 'game-over'`, return unchanged.
2. If current player is not a bot, return unchanged. (Defensive — stale dispatch after turn flip.)
3. Call `decideBotAction(state, state.botDifficulty ?? 'hard')`. If it returns `null`, return unchanged.
4. Call `executeBotAction(state, action)`. On success, return the new state.
5. On `{ error }`, fall back to `drawCard(state)`. If that also errors, return unchanged (truly stuck; clock will stop because next render sees same state).

The clock cleanup function guarantees no timer leaks. The narrow dependency array ensures re-schedules only happen when something the bot cares about has changed — not on every dispatch.

### 5.5 Bot brain interface

`shared/bot/types.ts`:

```typescript
export type BotDifficulty = 'easy' | 'hard';

export type BotAction =
  | { kind: 'beginTurn' }
  | { kind: 'playIdentical'; cardId: string }
  | { kind: 'playFractionAttack'; cardId: string }
  | { kind: 'rollDice' }
  | { kind: 'confirmEquation'; target: number; equationDisplay: string;
      equationCommits: EquationCommitPayload[] }
  | { kind: 'stageCard'; cardId: string }
  | { kind: 'unstageCard'; cardId: string }
  | { kind: 'confirmStaged' }
  | { kind: 'drawCard' }
  | { kind: 'endTurn' }
  | { kind: 'defendFractionSolve'; cardId: string; wildResolve?: number }
  | { kind: 'defendFractionPenalty' }
  | { kind: 'playFractionBlock'; cardId: string };
```

`shared/bot/botBrain.ts` — `decideBotAction(state, difficulty): BotAction | null`:

| Phase | Condition | Action |
|---|---|---|
| `turn-transition` | — | `beginTurn` |
| `pre-roll` | `pendingFractionTarget !== null`, divisible number in hand | `defendFractionSolve` |
| `pre-roll` | `pendingFractionTarget !== null`, wild in hand | `defendFractionSolve` (wildResolve = `fractionPenalty`) |
| `pre-roll` | `pendingFractionTarget !== null`, counter-fraction in hand | `playFractionBlock` |
| `pre-roll` | `pendingFractionTarget !== null`, none of the above | `defendFractionPenalty` |
| `pre-roll` | identical-playable card in hand | `playIdentical` |
| `pre-roll` | attack-fraction playable on top of discard | `playFractionAttack` |
| `pre-roll` | — | `rollDice` |
| `building` | `buildBotStagedPlan(state, difficulty)` returns a plan | `confirmEquation` |
| `building` | no plan | `drawCard` |
| `solved` | planned cards remain in hand (not yet staged) | next `stageCard` |
| `solved` | all planned cards staged | `confirmStaged` |
| `solved` | staged state is no longer valid | `unstageCard` (rollback) |
| `game-over` | — | `null` |

The plan is **never stored**. `buildBotStagedPlan` is called every tick and must converge — i.e., given the same state, it returns the same plan, so the bot can incrementally execute it across ticks by re-computing.

`buildBotStagedPlan(state, difficulty)` is the only place Profile 3 matters:

```typescript
// Hard: maximize cards discarded per equation
// Easy: minimize cards discarded per equation
const better = difficulty === 'easy'
  ? (candidate: number, best: number) => candidate < best
  : (candidate: number, best: number) => candidate > best;

if (!bestPlan || better(score, bestPlan.score)) {
  bestPlan = { ...candidatePlan, score };
}
```

That is the entire "Easy" implementation. The Profile 3 decision made during brainstorming is deliberate: `handleBotDefense` (divisible → wild → counter → penalty) and `handleBotPreRoll` (identical → attack-fraction → roll) are **untouched** by `difficulty`. Only `buildBotStagedPlan`'s scoring comparator flips. Every identical play, every defense choice, every draw decision is identical between Easy and Hard. The only observable difference is that Easy's equations discard fewer cards per turn, which directly slows the bot's card count reduction. This is what makes Profile 3 measurable: a single counter (average cards discarded per equation) distinguishes the two difficulties.

`shared/bot/executor.ts` — `executeBotAction(state, action)`:

```typescript
export function executeBotAction(
  state: ServerGameState,
  action: BotAction,
): ServerGameState | { error: LocalizedMessage } {
  switch (action.kind) {
    case 'beginTurn': return beginTurn(state);
    case 'rollDice': return doRollDice(state);
    case 'playIdentical': return playIdentical(state, action.cardId);
    case 'playFractionAttack':
    case 'playFractionBlock': return playFraction(state, action.cardId);
    case 'confirmEquation': return confirmEquation(
      state, action.target, action.equationDisplay, action.equationCommits
    );
    case 'stageCard': return stageCard(state, action.cardId);
    case 'unstageCard': return unstageCard(state, action.cardId);
    case 'confirmStaged': return confirmStaged(state);
    case 'drawCard': return drawCard(state);
    case 'endTurn': return doEndTurn(state);
    case 'defendFractionSolve':
      return defendFractionSolve(state, action.cardId, action.wildResolve);
    case 'defendFractionPenalty': return defendFractionPenalty(state);
  }
}
```

### 5.6 Server rewire

`server/src/socketHandlers.ts` loses roughly 140 lines. The bot logic in `runBotStep` becomes:

```typescript
function runBotStep(io: IOServer, room: Room): void {
  clearBotActionTimer(room);
  if (!room.state || room.state.phase === 'game-over') return;
  const player = currentPlayer(room);
  if (!player?.isBot || player.isEliminated || player.isSpectator) return;

  const action = decideBotAction(room.state, 'hard');
  if (!action) return;
  applyBotState(io, room, (s) => executeBotAction(s, action));
  scheduleBotAction(io, room);
}
```

Online multiplayer bot difficulty is hardcoded to `'hard'`. If online bot difficulty selection is ever wanted, it becomes a `HostGameSettings` field — out of scope for this spec.

## 6. UI Changes

### 6.1 `StartScreen.tsx` — new layout

```
┌─────────────────────────────────┐
│         [Salinda logo]           │
│      (subtitle)                  │
│                                  │
│  Mode:                           │
│    [ Pass and play ] [ Vs Bot ]  │   ← segmented control, two equal options
│                                  │
│  [if Vs Bot:]                    │
│    Bot difficulty:               │
│      [ Easy ] [ Hard ]           │   ← default Easy
│    Your name: [_________]        │
│                                  │
│  [if Pass and play:]             │
│    (existing player count +      │
│     player names UI, unchanged)  │
│                                  │
│  Game rule set:                  │
│    [ Easy ] [ Full ]             │   ← existing easy/full toggle
│                                  │
│  ▸ Advanced game settings        │   ← collapsed disclosure
│                                  │
│  [ Start game ]                  │
│  [ Show rules ]                  │
└─────────────────────────────────┘
```

Mode defaults to **Pass and play** so existing users are not disrupted. Bot difficulty defaults to **Easy**.

### 6.2 Advanced settings disclosure

When expanded, exposes:

| Setting | Control | Default |
|---|---|---|
| `enabledOperators` | Checkbox list `+ − × ÷` | `['+']` |
| `mathRangeMax` | Number input | `25` |
| `allowNegativeTargets` | Switch | `false` |
| `showFractions` | Switch | `true` |
| `showPossibleResults` | Switch | `true` |
| `showSolveExercise` | Switch | `true` |
| `timerSetting` | Radio `off / 30 / 60 / custom` | `off` |
| `timerCustomSeconds` | Number input (only when custom) | `60` |

Hidden from the panel (hardcoded to engine defaults): `diceMode` (`'3'`), `difficultyStage` (derived from easy/full toggle), `abVariant` (default).

### 6.3 Start dispatch

- **Pass-and-play:** `dispatch({ type: 'START_GAME', mode: 'pass-and-play', players: humanPlayers, difficulty, hostGameSettings })` — `botDifficulty` omitted; `botPlayerIds` becomes empty.
- **Vs-bot:** `dispatch({ type: 'START_GAME', mode: 'vs-bot', players: [{ name: humanName, isBot: false }, { name: botName, isBot: true }], difficulty, botDifficulty, hostGameSettings })`.

The reducer synthesizes a local-only `Room` shape `{ code: 'LOCAL', players }` to call `shared/gameEngine.ts`'s `startGame(room, difficulty, hostGameSettings)`. The resulting state is augmented with `botDifficulty` and `botPlayerIds` before being stored.

### 6.4 `GameScreen.tsx` — rebuild per P1

"Rebuild in place" means the file keeps its name and general layout, but its guts are rewritten to drive the new engine. The old `GameContext` reducer is **deleted** (§5.1, §5.3); this section is about the *screen file*, not the reducer. The local card-play interaction is rebuilt on top of the new engine's `building` → `solved` flow. Visual style (layout, colors, fonts, card renderings) is preserved; the interaction model changes:

- **Old:** select N cards, sum, press "Play."
- **New:** pick a result from `validTargets` in the `building` phase; the game transitions to `solved`; stage number/wild cards that satisfy the result; press "Confirm."

The interaction pattern mirrors the online-vs-bot UI as closely as possible. If `GameScreen.tsx` currently branches on local vs. online, those branches collapse — the local path is rewritten to drive the new engine, not the online path deleted. Screens that dispatch to a bot's turn disable all human input when `botPlayerIds.has(currentPlayer.id)`.

### 6.5 i18n keys (add to both `en.ts` and `he.ts`)

| Key | English | Hebrew |
|---|---|---|
| `start.mode` | Mode | מצב |
| `start.modePassAndPlay` | Pass and play | משחק מקומי |
| `start.modeVsBot` | Play vs Bot | שחק מול בוט |
| `start.botDifficulty` | Bot difficulty | רמת בוט |
| `start.botEasy` | Easy | קל |
| `start.botHard` | Hard | קשה |
| `start.advancedSettings` | Advanced game settings | הגדרות מתקדמות |
| `start.botName` | Bot | בוט |

Operator names, timer options, and other settings labels **reuse existing lobby translation keys**; no new keys for those.

## 7. Testing

### 7.1 Engine unit tests (`shared/gameEngine.ts`)

Pure-function tests driven by Vitest/Jest. Must cover:

- `startGame` produces a legal initial state (correct hand size, discard pile seeded, currentPlayerIndex within bounds).
- `doRollDice` generates valid targets matching `hostGameSettings.enabledOperators` and `mathRangeMax`.
- Full equation round: `beginTurn` → `doRollDice` → `confirmEquation` → `stageCard*` → `confirmStaged` completes a turn and advances `currentPlayerIndex`.
- Fraction attack chain: attacker plays `playFraction`; next player has `pendingFractionTarget !== null`; defender's `defendFractionSolve` with valid card advances; `defendFractionPenalty` draws correct count.
- Triple-dice penalty: every non-current player draws `die1` cards.
- Win condition: player with hand length ≤2 triggers `game-over`.

If server-side engine tests already exist, they are ported to `shared/` as part of milestone M1. If none exist, the suite above is written fresh in M1. **M1 cannot be merged without these tests green.**

### 7.2 Bot brain unit tests (`shared/bot/botBrain.ts`)

Pure-function tests driven by fixture states. Must cover:

- `turn-transition` → `{ kind: 'beginTurn' }`.
- `pre-roll` with identical-playable → `playIdentical`.
- `pre-roll` with attack-fraction playable → `playFractionAttack`.
- `pre-roll` with neither → `rollDice`.
- `pre-roll` under fraction defense, divisible number in hand → `defendFractionSolve`.
- `pre-roll` under fraction defense, only wild in hand → `defendFractionSolve` with `wildResolve: fractionPenalty`.
- `pre-roll` under fraction defense, only counter-fraction → `playFractionBlock`.
- `pre-roll` under fraction defense, nothing → `defendFractionPenalty`.
- `building` with winnable plan → `confirmEquation`.
- `building` with no plan → `drawCard`.
- `solved` with unstaged planned cards → `stageCard`.
- `solved` with all planned cards staged → `confirmStaged`.
- `solved` with invalid staged state → `unstageCard`.
- **Profile 3 test:** given an identical state, `decideBotAction(state, 'easy')` returns a `confirmEquation` with fewer staged cards than `decideBotAction(state, 'hard')`. This single test is the contract that Easy is measurably easier than Hard.

### 7.3 Manual playthrough checklist (before merging to main)

1. Online-vs-bot game on Render: completes end-to-end, bot plays normally. (Regresses `socketHandlers.ts` refactor.)
2. Offline single-player-vs-bot, Easy: completes; bot visibly plays timidly; human wins most games.
3. Offline single-player-vs-bot, Hard: completes; bot plays aggressively; human loses some games.
4. Offline pass-and-play, 2 players: completes. (Regresses `GameContext` rewire.)
5. Offline pass-and-play, 4 players: completes. (Regresses multi-player state handling.)
6. Online multi-human (no bot): completes. (Regresses engine-move.)
7. Advanced settings panel: changing `enabledOperators`, `mathRangeMax`, and `timerSetting` each produces the expected in-game effect.

## 8. Risks

Ranked by likelihood × blast radius:

| # | Risk | Mitigation |
|---|---|---|
| 1 | Engine move breaks production server | M1 lands as its own commit; server tests (or manual smoke of online mode) run green before proceeding to M2. Rollback is `git revert` of the single commit. |
| 2 | Rebuilding `GameScreen` card-play flow changes UX visibly | Mirror the online UI's interaction pattern; do not invent new UX; keep visual style constant. User (tom) accepts this as inherent to A-full. |
| 3 | Bot clock has subtle edge cases (stale dispatches, rapid re-schedules) | Narrow `useEffect` dependency array; defensive guard in the `BOT_STEP` reducer; fallback to `drawCard` on any bot-action error. |
| 4 | i18n drift between `en.ts` and `he.ts` | Every new key added to both files in the same commit. Existing i18n infrastructure falls back to English on missing keys at runtime. |
| 5 | React Native / Metro bundler rejects `node:crypto` imports from shared code | Already designed around — `shared/rng.ts` is pure JS. Server imports from `shared/rng.ts` too; no dual implementations. |

## 9. Rollout

Each milestone is a mergeable commit. Milestones 1–3 are server-side only. Milestones 4–7 are client-side only. If any milestone fails its gate, stop and reassess — do not bundle the next milestone's changes into a rescue commit.

| # | Milestone | Touches | Gate |
|---|---|---|---|
| M1 | Engine move to `shared/` | `server/src/gameEngine.ts` `deck.ts` `equations.ts` → `shared/`; add `shared/rng.ts`; update server imports | Engine unit tests pass; online multiplayer still works (manual smoke) |
| M2 | Shared bot brain + executor | Extract from `socketHandlers.ts` to `shared/bot/`; rewire `runBotStep` | Online-vs-bot still works (manual smoke) |
| M3 | Bot brain unit tests | `shared/bot/__tests__/botBrain.test.ts` | All tests pass including Profile 3 assertion |
| M4 | Client state layer rewire | Delete `src/types/game.ts`; rewrite `GameContext.tsx`; add bot clock | `GameContext` compiles. App is **intentionally broken** at this checkpoint — no screens touched. |
| M5 | Screen rewire | Every file that imported old action vocabulary; rebuild `GameScreen` card-play flow per P1 | Pass-and-play game playable end-to-end |
| M6 | `StartScreen` vs-bot entry point | Mode toggle, bot difficulty toggle, advanced disclosure, wire new `START_GAME` | Full manual playthrough checklist passes |
| M7 | Cleanup | Remove dead imports; verify no `src/types/game` references remain; re-run full manual checklist | No warnings; manual checklist clean |

## 10. Open Questions

None. All design questions were resolved during the brainstorming session. Any new question that arises during implementation returns to this spec for an amendment before code lands.
