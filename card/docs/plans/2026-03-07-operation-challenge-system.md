# Operation Challenge System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement operation card challenge obligation rules with soft enforcement, forward transfer mechanic, and positive feedback notifications.

**Architecture:** All changes in `index.tsx` (single-file architecture). Add state fields for challenge tracking, new FORWARD_CHALLENGE reducer action, modify CONFIRM_STAGED for soft enforcement + penalty, update challenge sheet UI, add feedback celebration sheet with 5 scenarios, and highlight forwardable cards in hand.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, useReducer, Animated API, CasinoButton component.

---

### Task 1: Add State Fields and Action Type

**Files:**
- Modify: `index.tsx:72-106` (GameState interface)
- Modify: `index.tsx:108-138` (GameAction type)
- Modify: `index.tsx:436-445` (initialState)

**Step 1: Add new fields to GameState**

After line 83 (`activeOperation`), add:
```typescript
challengeSource: string | null;       // name of player who set the active challenge
```

After line 82 (`equationResult`), add:
```typescript
equationOpsUsed: Operation[];         // operations used in confirmed equation
```

**Step 2: Add FORWARD_CHALLENGE action and extend CONFIRM_EQUATION**

In the GameAction union (after line 120 `PLAY_OPERATION`), add:
```typescript
| { type: 'FORWARD_CHALLENGE'; card: Card }
```

Modify CONFIRM_EQUATION action to include ops:
```typescript
| { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string; equationOps: Operation[] }
```

**Step 3: Add parallel operation mapping**

After the `opDisplay` mapping (around line 1084), add:
```typescript
const parallelOp: Record<string, string> = { '+': '-', '-': '+', 'x': '/', '/': 'x' };
```

**Step 4: Update initialState**

Add to initialState object:
```typescript
challengeSource: null, equationOpsUsed: [],
```

**Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 1+ errors (CONFIRM_EQUATION dispatch doesn't pass equationOps yet)

**Step 6: Fix CONFIRM_EQUATION dispatch in EquationBuilder**

In EquationBuilder's `hConfirm` function (~line 1516-1524), change the dispatch to:
```typescript
const usedOps: Operation[] = [];
if (effectiveOp1) usedOps.push(effectiveOp1 as Operation);
if (effectiveOp2) usedOps.push(effectiveOp2 as Operation);
dispatch({ type: 'CONFIRM_EQUATION', result: finalResult, equationDisplay: display, equationOps: usedOps });
```

**Step 7: Update CONFIRM_EQUATION reducer case**

In the CONFIRM_EQUATION case (~line 586-588), store the ops:
```typescript
case 'CONFIRM_EQUATION': {
  if (st.phase !== 'building') return st;
  return { ...st, phase: 'solved', equationResult: action.result, equationOpsUsed: action.equationOps, lastEquationDisplay: action.equationDisplay, stagedCards: [], message: '' };
}
```

**Step 8: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 9: Commit**

```bash
git add index.tsx
git commit -m "feat: add state fields for challenge tracking (challengeSource, equationOpsUsed, FORWARD_CHALLENGE action)"
```

---

### Task 2: Implement FORWARD_CHALLENGE Reducer Action

**Files:**
- Modify: `index.tsx` — add new reducer case after PLAY_OPERATION (~line 697)

**Step 1: Add FORWARD_CHALLENGE case**

After the PLAY_OPERATION case, add:
```typescript
case 'FORWARD_CHALLENGE': {
  // Forward transfer: place opposite operation card, end turn immediately
  if (st.phase !== 'pre-roll') return st;
  if (!st.activeOperation) return st;
  if (st.hasPlayedCards) return st;
  const fwdExpected = parallelOp[st.activeOperation];
  const fwdOp = action.card.type === 'joker' ? fwdExpected : action.card.operation;
  if (fwdOp !== fwdExpected) return st;
  const fwdCp = st.players[st.currentPlayerIndex];
  const fwdNp = st.players.map((p, i) =>
    i === st.currentPlayerIndex ? { ...p, hand: fwdCp.hand.filter(c => c.id !== action.card.id) } : p);
  const fwdDiscard = [...st.discardPile, action.card];
  let fwdNs: GameState = {
    ...st, players: fwdNp, discardPile: fwdDiscard,
    activeOperation: fwdOp as Operation,
    challengeSource: fwdCp.name,
    hasPlayedCards: true,
    lastMoveMessage: `⚔️ ${fwdCp.name} העביר/ה את האתגר עם ${opDisplay[fwdOp!] ?? fwdOp}!`,
    message: '',
  };
  fwdNs = checkWin(fwdNs);
  if (fwdNs.phase === 'game-over') return fwdNs;
  return endTurnLogic(fwdNs);
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 3: Commit**

```bash
git add index.tsx
git commit -m "feat: add FORWARD_CHALLENGE reducer action for challenge transfer"
```

---

### Task 3: Update endTurnLogic to Track challengeSource

**Files:**
- Modify: `index.tsx:504-525` (endTurnLogic function)

**Step 1: Persist challengeSource alongside activeOperation**

In endTurnLogic, the `keepOp` logic already preserves `activeOperation`. Add `challengeSource` tracking:

Change line 519 area to also handle challengeSource:
```typescript
return {
  ...s,
  // ... existing fields ...
  activeOperation: keepOp ? s.activeOperation : null,
  challengeSource: keepOp ? s.challengeSource : null,
  // ... rest of fields ...
};
```

**Step 2: Update all places that reset state to include challengeSource: null**

Search for all places that set `activeOperation: null` and add `challengeSource: null` alongside:
- START_GAME case (~line 529): add `challengeSource: null`
- BEGIN_TURN/endTurnLogic turn-transition (~line 525): already handled above
- Any other state resets that include `activeOperation: null`

Also update places that SET activeOperation to also set challengeSource:
- CONFIRM_STAGED (~line 641): when `stNewActiveOp` is set, also set `challengeSource: stCp.name`
- CONFIRM_TRAP_ONLY (~line 656): set `challengeSource: trapCp.name`
- PLAY_OPERATION (~line 695): set `challengeSource: cp.name`

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat: track challengeSource through turn transitions"
```

---

### Task 4: Implement Soft Enforcement in CONFIRM_STAGED

**Files:**
- Modify: `index.tsx:610-644` (CONFIRM_STAGED case)

**Step 1: Add challenge enforcement logic**

After the valid cards are confirmed and before building the final state (around line 635), add challenge enforcement:

```typescript
// Soft enforcement: check if challenged player used the required operation
const hadChallenge = !!st.activeOperation;
const challengeOp = st.activeOperation;
const usedChallengeOp = hadChallenge && challengeOp
  ? st.equationOpsUsed.includes(challengeOp)
  : false;

// Determine feedback scenario
const placedNewOp = !!stNewActiveOp;
let feedbackType: string | null = null;
if (hadChallenge && usedChallengeOp && placedNewOp) {
  feedbackType = 'double-move';      // Used challenge op AND attacked
} else if (hadChallenge && usedChallengeOp) {
  feedbackType = 'challenge-success'; // Responded to challenge
} else if (hadChallenge && !usedChallengeOp) {
  feedbackType = 'challenge-penalty'; // Didn't use challenge op
} else if (placedNewOp) {
  feedbackType = 'attack-sent';       // Placed op card (no incoming challenge)
}
```

**Step 2: Apply penalty for not using challenge op**

After the feedback logic, before building `stNs`:
```typescript
// Penalty: draw 1 card if challenged but didn't use the operation
let penaltyState = { players: stNp, drawPile: st.drawPile };
if (feedbackType === 'challenge-penalty') {
  const penResult = drawFromPile({ ...st, players: stNp } as GameState, 1, st.currentPlayerIndex);
  penaltyState = { players: penResult.players, drawPile: penResult.drawPile };
}
```

**Step 3: Update toast messages based on feedback scenario**

Replace the existing stToast logic with scenario-based messages:
```typescript
const stToast = feedbackType === 'double-move'
  ? `🌟 ${stCp.name}: מהלך כפול! תקיפה + פתרון!`
  : feedbackType === 'challenge-success'
  ? `🎉 ${stCp.name} התמודד/ה עם האתגר!`
  : feedbackType === 'challenge-penalty'
  ? `😬 ${stCp.name} לא השתמש/ה בסימן האתגר — קלף עונש!`
  : feedbackType === 'attack-sent'
  ? `🎯 ${stCp.name}: אתגר הוטל!`
  : `✅ ${stCp.name}: ${st.lastEquationDisplay || ''} → הניח ${stLastNum.value}`;
```

**Step 4: Use penaltyState in the final state**

Update the `stNs` construction to use `penaltyState.players` and `penaltyState.drawPile`:
```typescript
let stNs: GameState = { ...st,
  players: penaltyState.players,
  drawPile: penaltyState.drawPile,
  discardPile: stDiscard, stagedCards: [], selectedCards: [],
  consecutiveIdenticalPlays: 0, hasPlayedCards: true,
  lastCardValue: stLastNum.value ?? null,
  activeOperation: stNewActiveOp || null,
  challengeSource: stNewActiveOp ? stCp.name : null,
  equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null,
  equationOpsUsed: [],
  lastMoveMessage: stToast, lastEquationDisplay: null,
  message: stNewActiveOp ? `אתגר פעולה ${stNewActiveOp} לשחקן הבא!` : '',
};
```

**Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 6: Commit**

```bash
git add index.tsx
git commit -m "feat: soft enforcement in CONFIRM_STAGED with penalty card for skipping challenge op"
```

---

### Task 5: Add Forward Challenge to Card Tap Handler

**Files:**
- Modify: `index.tsx:2223-2226` (PlayerHand tap handler, pre-roll section)

**Step 1: Add forward challenge tap in pre-roll phase**

In the `tap` function inside PlayerHand, at the start of the `if (pr)` block (line 2223), add before existing pre-roll logic:

```typescript
if (pr) {
  // Forward challenge: tap opposite operation card to transfer
  if (state.activeOperation && card.type === 'operation') {
    const opposite = parallelOp[state.activeOperation];
    if (card.operation === opposite) {
      dispatch({ type: 'FORWARD_CHALLENGE', card });
      return;
    }
  }
  // existing pre-roll code...
  if (card.type === 'fraction') { /* ... existing ... */ }
  if (state.consecutiveIdenticalPlays < 2 && validateIdenticalPlay(card,td)) dispatch({type:'PLAY_IDENTICAL',card}); return;
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 3: Commit**

```bash
git add index.tsx
git commit -m "feat: add forward challenge tap handling in pre-roll phase"
```

---

### Task 6: Update Challenge Sheet UI

**Files:**
- Modify: `index.tsx:3353-3391` (opChallengeVisible sheet)

**Step 1: Rewrite challenge sheet content**

Replace the challenge sheet content with updated design showing:
- Who challenged: `{challengeSource} אתגר/ה אותך עם {symbol}!`
- Option 1: Use the symbol in your equation (roll dice)
- Option 2: Place opposite card to forward (if available)
- Highlight if player has the opposite card

The sheet should show `state.challengeSource` for the attacker name, and explain both options. Show the opposite operation needed for forwarding using `parallelOp[state.activeOperation]`.

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 3: Commit**

```bash
git add index.tsx
git commit -m "feat: update challenge sheet with two-option UI and challenger name"
```

---

### Task 7: Update Celebration Sheet for 5 Feedback Scenarios

**Files:**
- Modify: `index.tsx:2826-2844` (opCeleb state + effect)
- Modify: `index.tsx:3393-3405` (opCeleb rendering)

**Step 1: Extend celebration state to support multiple scenarios**

Replace the single opCelebVisible/opCelebOp with scenario tracking:
```typescript
const [opFeedback, setOpFeedback] = useState<{
  type: 'double-move' | 'challenge-success' | 'challenge-penalty' | 'attack-sent' | 'forward';
  op: string;
} | null>(null);
const opFeedbackY = useRef(new Animated.Value(200)).current;
```

**Step 2: Update the effect that triggers celebration**

The effect should detect the feedback type from `lastMoveMessage` content (since the reducer sets specific emoji prefixes for each scenario). Trigger on phase transitions:

- On turn-transition with activeOperation set → 'attack-sent' or 'forward'
- Check lastMoveMessage prefix to determine type:
  - Starts with `🌟` → 'double-move'
  - Starts with `🎉` → 'challenge-success'
  - Starts with `😬` → 'challenge-penalty'
  - Starts with `🎯` → 'attack-sent'
  - Starts with `⚔️` and includes `העביר` → 'forward'

**Step 3: Render scenario-specific celebration content**

Replace the generic celebration sheet with scenario-specific rendering:

| Type | Emoji | Title | Color | Border |
|------|-------|-------|-------|--------|
| double-move | 🌟 | מהלך כפול! תקפת וגם פתרת בתרגיל! | #FFD700 gold | gold |
| challenge-success | 🎉 | כל הכבוד! התמודדת עם האתגר! | #4ADE80 green | green |
| challenge-penalty | 😬 | לא השתמשת בסימן האתגר — קלף עונש! | #F59E0B amber | amber/red |
| attack-sent | 🎯 | האתגר הוטל! השחקן הבא יצטרך להתמודד! | #4ADE80 green | green |
| forward | ⚔️ | תזוזה מבריקה! הפכת את ההתקפה! | #A78BFA purple | purple |

Auto-dismiss after 3 seconds for positive messages, 4 seconds for penalty.

**Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 5: Commit**

```bash
git add index.tsx
git commit -m "feat: 5-scenario positive feedback celebration sheet"
```

---

### Task 8: Highlight Forwardable Card in Hand

**Files:**
- Modify: `index.tsx` — SimpleHand component (around line 2100-2190)
- Modify: `index.tsx` — PlayerHand component (around line 2199-2260)

**Step 1: Pass forwardable card ID to SimpleHand**

In PlayerHand, compute the forwardable card ID:
```typescript
const forwardCardId = (pr && state.activeOperation)
  ? cp.hand.find(c => c.type === 'operation' && c.operation === parallelOp[state.activeOperation!])?.id ?? null
  : null;
```

Pass `forwardCardId` as a prop to SimpleHand.

**Step 2: Add pulsing gold border animation in SimpleHand**

In SimpleHand, for the card matching `forwardCardId`:
- Add a gold pulsing border (Animated.View with looping opacity animation)
- Add a small label above the card: "⚔️ העבר את האתגר"
- Use `borderColor: '#FFD700'` with `borderWidth: 2.5` and animated opacity

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat: highlight forwardable operation card with gold pulsing border"
```

---

### Task 9: Clean Up Dead Code and Final State Reset Sweep

**Files:**
- Modify: `index.tsx` — multiple locations

**Step 1: Add equationOpsUsed and challengeSource to all state resets**

Search for all places that reset game state and ensure new fields are included:
- `equationOpsUsed: []` wherever `equationResult: null` is reset
- `challengeSource: null` wherever `activeOperation: null` is reset
- Key locations: START_GAME, BEGIN_TURN, endTurnLogic, REVERT_TO_BUILDING, DRAW_CARD, END_TURN

**Step 2: Review CONFIRM_TRAP_ONLY (dead code check)**

CONFIRM_TRAP_ONLY guards on `equationOpPosition !== 2`, but PLACE_EQ_OP only allows positions 0 and 1. This case can never trigger. Consider removing or leaving as-is (it's harmless).

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -c "index.tsx"`
Expected: 0 errors

**Step 4: Full manual test checklist**

Test on device via Expo Go:
- [ ] Start game, roll dice, build equation → no challenge, normal message
- [ ] Place operation card in equation slot, confirm → next player sees challenge sheet with your name
- [ ] As challenged player, use required op in equation → green celebration "כל הכבוד!"
- [ ] As challenged player, solve WITHOUT required op → amber warning + 1 penalty card drawn
- [ ] As challenged player, tap opposite op card in pre-roll → forward transfer, turn ends, next player challenged
- [ ] Forward transfer shows "תזוזה מבריקה!" celebration
- [ ] Place op card AND use it in equation → "מהלך כפול!" gold celebration
- [ ] Opposite card in hand has gold pulsing border + label during pre-roll when challenged
- [ ] Challenge sheet shows correct opponent name and two options
- [ ] All celebrations auto-dismiss after 3-4 seconds

**Step 5: Commit**

```bash
git add index.tsx
git commit -m "feat: complete operation challenge system — cleanup and state reset sweep"
```
