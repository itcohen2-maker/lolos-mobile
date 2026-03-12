# Shield Card (קלף שמירה) — Design Document

**Date:** 2026-03-09  
**Status:** Design only — not yet implemented.  
**Context:** Part of future ideas for Lolos (TakiMaster); see plan "רעיונות עתידיים למשחק לולוס".

---

## 1. Goal

Introduce a **Shield** card type that protects the player from one **fraction challenge** or one **operation challenge** for a single turn. This adds a tactical defensive option without changing core win conditions.

---

## 2. Card Definition

| Field | Value |
|-------|--------|
| **Type** | `'shield'` (new `CardType`) |
| **Display** | Single card: e.g. "🛡️ שמירה" or shield icon + label |
| **Effect** | When played: cancel the current challenge (fraction or operation) for this turn only. |
| **When playable** | Only at the start of a turn when the player is under a challenge (fraction attack or operation challenge). |
| **Deck count** | TBD (e.g. 2–4 per deck). |

---

## 3. Rules (Summary)

- **Play timing:** At the beginning of the turn, before rolling dice or playing any other card. If the player has an active **fraction challenge** (`pendingFractionTarget !== null`) or **operation challenge** (`activeOperation !== null`), they may play one Shield card.
- **Effect:** The challenge is cancelled for this turn:
  - **Fraction:** `pendingFractionTarget`, `fractionPenalty`, and any related attack state are cleared; the turn continues as a normal pre-roll (player may roll dice or play identical, etc.).
  - **Operation:** `activeOperation` and `challengeSource` are cleared; the turn continues as a normal pre-roll.
- **One-shot:** Playing the Shield ends the "obligation" for that challenge only. It does not protect from a new challenge set later in the same round by another player.
- **No other action with Shield:** Playing the Shield is the only action in that "response" step; the player does not also play another card (e.g. operation or number) in the same response. After playing the Shield, the turn continues (e.g. roll dice or play identical in pre-roll).

---

## 4. State and Reducer Changes (Outline)

- **Types:** Extend `CardType` with `'shield'`. Extend `Card` (e.g. no extra fields; `type: 'shield'` is enough). Update `generateDeck()` to add N Shield cards.
- **New action:** e.g. `PLAY_SHIELD: { card: Card }`.
- **Reducer (PLAY_SHIELD):**
  - Allowed only when `phase === 'pre-roll'` and `!hasPlayedCards` and (`pendingFractionTarget !== null` or `activeOperation !== null`).
  - Remove the card from current player's hand, add to discard pile.
  - If fraction challenge: set `pendingFractionTarget`, `fractionPenalty`, `fractionAttackResolved`, etc., to cleared/default.
  - If operation challenge: set `activeOperation`, `challengeSource` to null.
  - Set `hasPlayedCards: true` (so the player cannot also play another card in the same "response"); optionally do **not** end the turn so the player can then roll dice or play identical in the same turn. (Exact flow: either "play Shield → then continue to same turn pre-roll" or "play Shield → end turn" — design choice; recommended: **continue same turn** so the Shield only cancels the obligation, and the player can then act normally.)
- **UI:** In pre-roll, when under challenge, if the player has a Shield card, show it as playable (tap to play Shield). Show a short toast or message: "🛡️ שמירה — האתגר בוטל".

---

## 5. UI / UX Notes

- **Hand:** Render Shield card with a distinct style (e.g. shield icon, border color).
- **When to highlight:** Only when `(pendingFractionTarget !== null || activeOperation !== null)` and `!hasPlayedCards` and phase is pre-roll.
- **Accessibility:** Label and screen reader text: "קלף שמירה — מבטל אתגר שבר או אתגר פעולה בתור זה".

---

## 6. Optional Extensions (Future)

- **Shield vs. forward:** If the player has both a Shield and a forward card (e.g. opposite operation), they choose one: cancel challenge (Shield) or forward it. No stacking (one response only).
- **Limit one Shield per turn** (already implied if we set `hasPlayedCards: true` and only allow one Shield play per challenge response).

---

## 7. Implementation Checklist (When Implementing)

- [ ] Add `'shield'` to `CardType` and extend `Card` if needed.
- [ ] Add Shield cards to `generateDeck()` (count and shuffle).
- [ ] Add `PLAY_SHIELD` action and handle in reducer (clear fraction or operation challenge; keep turn in pre-roll).
- [ ] In hand tap logic (pre-roll, under challenge), allow playing Shield.
- [ ] Add Shield card component (visual) and integrate into `GameCard` / hand.
- [ ] Update Rules screen (מסך כללים) to describe the Shield card.
- [ ] Add tests or manual test cases: fraction challenge → play Shield → turn continues; operation challenge → play Shield → turn continues.

---

*This document is a design spec only. Implementation will follow in a separate plan or task list.*
