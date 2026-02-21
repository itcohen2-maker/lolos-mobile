// ============================================================
// index.tsx — Lolos Card Game — FULL SINGLE FILE
// LinearGradient cards, 3D shadows, rotated deck, thick edges
// ============================================================

import React, { useState, useEffect, useRef, createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  I18nManager, View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Modal as RNModal, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { registerRootComponent } from 'expo';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type CardType = 'number' | 'fraction' | 'operation' | 'joker';
type Operation = '+' | '-' | 'x' | '÷';
type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

interface Card {
  id: string;
  type: CardType;
  value?: number;
  fraction?: Fraction;
  operation?: Operation;
}

interface Player {
  id: number;
  name: string;
  hand: Card[];
  calledLolos: boolean;
}

interface DiceResult { die1: number; die2: number; die3: number; }
interface EquationOption { equation: string; result: number; }

type GamePhase = 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'game-over';

interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: DiceResult | null;
  selectedCards: Card[];
  validTargets: EquationOption[];
  equationResult: number | null;
  activeOperation: Operation | null;
  activeFraction: Fraction | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  identicalPlayCount: number;
  jokerModalOpen: boolean;
  difficulty: 'easy' | 'full';
  winner: Player | null;
  message: string;
}

type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full' }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE' }
  | { type: 'CONFIRM_EQUATION'; result: number }
  | { type: 'CONFIRM_AND_DISCARD'; result: number }
  | { type: 'SELECT_CARD'; card: Card }
  | { type: 'DISCARD_AND_END' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'PLAY_OPERATION'; card: Card }
  | { type: 'PLAY_FRACTION'; card: Card }
  | { type: 'DEFEND_FRACTION_SOLVE'; card: Card }
  | { type: 'DEFEND_FRACTION_PENALTY' }
  | { type: 'PLAY_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'DRAW_CARD' }
  | { type: 'CALL_LOLOS' }
  | { type: 'END_TURN' }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'OPEN_JOKER_MODAL'; card: Card }
  | { type: 'CLOSE_JOKER_MODAL' }
  | { type: 'RESET_GAME' };

// ═══════════════════════════════════════════════════════════════
//  ARITHMETIC — strict Left-to-Right
// ═══════════════════════════════════════════════════════════════

function applyOperation(a: number, op: Operation, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': return a * b;
    case '÷': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function fractionDenominator(f: Fraction): number {
  switch (f) { case '1/2': return 2; case '1/3': return 3; case '1/4': return 4; case '1/5': return 5; }
}

function isDivisibleByFraction(value: number, f: Fraction): boolean {
  const d = fractionDenominator(f);
  return value % d === 0 && value > 0;
}

function validateFractionPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!card.fraction || !topDiscard) return false;
  if (topDiscard.type !== 'number' || topDiscard.value === undefined) return false;
  return isDivisibleByFraction(topDiscard.value, card.fraction as Fraction);
}

const EQ_OPS_STR = ['+', '-', '*', '/'];

function getCurrentResult(
  s1: number | null, op1: string, s2: number | null, op2: string, s3: number | null,
): number | null {
  try {
    const calc = (x: number, op: string, y: number): number | null => {
      switch (op) {
        case '+': return x + y; case '-': return x - y;
        case '*': case 'x': case '×': return x * y;
        case '/': case '÷': return y !== 0 && x % y === 0 ? x / y : null;
        default: return null;
      }
    };
    if (s1 === null || s2 === null) return null;
    const intermediate = calc(s1, op1, s2);
    if (intermediate === null) return null;
    if (s3 !== null) {
      const final = calc(intermediate, op2, s3);
      if (final === null || !Number.isFinite(final)) return null;
      return final;
    }
    if (!Number.isFinite(intermediate)) return null;
    return intermediate;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DECK
// ═══════════════════════════════════════════════════════════════

let cardIdCounter = 0;
function makeId(): string { return `card-${++cardIdCounter}`; }

function generateDeck(difficulty: 'easy' | 'full'): Card[] {
  cardIdCounter = 0;
  const cards: Card[] = [];
  const maxNumber = difficulty === 'easy' ? 12 : 25;
  for (let set = 0; set < 4; set++)
    for (let v = 0; v <= maxNumber; v++)
      cards.push({ id: makeId(), type: 'number', value: v });
  const fracs: { frac: Fraction; count: number }[] = [
    { frac: '1/2', count: 6 }, { frac: '1/3', count: 4 },
    { frac: '1/4', count: 4 }, { frac: '1/5', count: 4 },
  ];
  for (const { frac, count } of fracs)
    for (let i = 0; i < count; i++)
      cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  const operations: Operation[] = ['+', '-', 'x', '÷'];
  for (const op of operations)
    for (let i = 0; i < 4; i++)
      cards.push({ id: makeId(), type: 'operation', operation: op });
  for (let i = 0; i < 4; i++)
    cards.push({ id: makeId(), type: 'joker' });
  return cards;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealCards(deck: Card[], playerCount: number, cardsPerPlayer: number) {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let idx = 0;
  for (let c = 0; c < cardsPerPlayer; c++)
    for (let p = 0; p < playerCount; p++)
      if (idx < deck.length) hands[p].push(deck[idx++]);
  return { hands, remaining: deck.slice(idx) };
}

// ═══════════════════════════════════════════════════════════════
//  DICE
// ═══════════════════════════════════════════════════════════════

function rollDiceUtil(): DiceResult {
  return {
    die1: Math.floor(Math.random() * 6) + 1,
    die2: Math.floor(Math.random() * 6) + 1,
    die3: Math.floor(Math.random() * 6) + 1,
  };
}

function isTriple(dice: DiceResult): boolean {
  return dice.die1 === dice.die2 && dice.die2 === dice.die3;
}

const ALL_OPS: Operation[] = ['+', '-', 'x', '÷'];

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

function generateValidTargets(dice: DiceResult): EquationOption[] {
  const values = [dice.die1, dice.die2, dice.die3];
  const perms = permutations(values);
  const seen = new Set<string>();
  const results: EquationOption[] = [];

  for (const [a, b, c] of perms) {
    for (const op1 of ALL_OPS) {
      for (const op2 of ALL_OPS) {
        const ab = applyOperation(a, op1, b);
        if (ab !== null) {
          const r = applyOperation(ab, op2, c);
          if (r !== null && r >= 0 && Number.isInteger(r)) {
            const eq = `${a} ${op1} ${b} ${op2} ${c} = ${r}`;
            if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push({ equation: eq, result: r }); }
          }
        }
      }
    }
  }

  const pairs: [number, number][] = [
    [values[0], values[1]], [values[0], values[2]], [values[1], values[2]],
  ];
  for (const [a, b] of pairs) {
    for (const op of ALL_OPS) {
      const r1 = applyOperation(a, op, b);
      if (r1 !== null && r1 >= 0 && Number.isInteger(r1)) {
        const eq1 = `${a} ${op} ${b} = ${r1}`;
        if (!seen.has(`${r1}:${eq1}`)) { seen.add(`${r1}:${eq1}`); results.push({ equation: eq1, result: r1 }); }
      }
      const r2 = applyOperation(b, op, a);
      if (r2 !== null && r2 >= 0 && Number.isInteger(r2)) {
        const eq2 = `${b} ${op} ${a} = ${r2}`;
        if (!seen.has(`${r2}:${eq2}`)) { seen.add(`${r2}:${eq2}`); results.push({ equation: eq2, result: r2 }); }
      }
    }
  }

  const byResult = new Map<number, EquationOption>();
  for (const opt of results)
    if (!byResult.has(opt.result)) byResult.set(opt.result, opt);
  return Array.from(byResult.values()).sort((a, b) => a.result - b.result);
}

// ═══════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════

function validateIdenticalPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!topDiscard || card.type !== topDiscard.type) return false;
  switch (card.type) {
    case 'number': return card.value === topDiscard.value;
    case 'fraction': return card.fraction === topDiscard.fraction;
    case 'operation': return card.operation === topDiscard.operation;
    case 'joker': return topDiscard.type === 'joker';
    default: return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  GAME REDUCER
// ═══════════════════════════════════════════════════════════════

const CARDS_PER_PLAYER = 10;

const initialState: GameState = {
  phase: 'setup', players: [], currentPlayerIndex: 0, drawPile: [], discardPile: [],
  dice: null, selectedCards: [], validTargets: [], equationResult: null,
  activeOperation: null, activeFraction: null, pendingFractionTarget: null,
  fractionPenalty: 0, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
  identicalPlayCount: 0, jokerModalOpen: false, difficulty: 'full', winner: null, message: '',
};

function reshuffleDiscard(st: GameState): GameState {
  if (st.drawPile.length > 0 || st.discardPile.length <= 1) return st;
  const top = st.discardPile[st.discardPile.length - 1];
  return { ...st, drawPile: shuffle(st.discardPile.slice(0, -1)), discardPile: [top] };
}

function drawFromPile(st: GameState, count: number, pi: number): GameState {
  let s = { ...st, players: st.players.map(p => ({ ...p, hand: [...p.hand] })) };
  for (let i = 0; i < count; i++) {
    s = reshuffleDiscard(s);
    if (s.drawPile.length === 0) break;
    s.players[pi].hand.push(s.drawPile[0]);
    s.drawPile = s.drawPile.slice(1);
  }
  return s;
}

function checkWin(st: GameState): GameState {
  const cp = st.players[st.currentPlayerIndex];
  if (cp.hand.length === 0 && cp.calledLolos)
    return { ...st, phase: 'game-over', winner: cp };
  if (cp.hand.length === 0 && !cp.calledLolos) {
    const s = drawFromPile(st, 1, st.currentPlayerIndex);
    if (s.players[st.currentPlayerIndex].hand.length === 0)
      return { ...s, phase: 'game-over', winner: cp };
    return { ...s, message: `${cp.name} שכח/ה לקרוא לולוס! שלף/י קלף אחד.` };
  }
  return st;
}

function endTurnLogic(st: GameState): GameState {
  let s = { ...st };
  let keepOp = false;
  if (s.activeOperation && !s.hasPlayedCards) {
    s = drawFromPile(s, 2, s.currentPlayerIndex);
    s.message = `${s.players[s.currentPlayerIndex].name} קיבל/ה עונש ${s.activeOperation}!`;
  } else if (s.activeOperation && s.hasPlayedCards) {
    keepOp = true;
  }
  const up = s.players[s.currentPlayerIndex];
  if (up.hand.length === 1 && !up.calledLolos) {
    s = drawFromPile(s, 1, s.currentPlayerIndex);
    s.message = `${up.name} שכח/ה לקרוא לולוס! שלף/ה קלף עונשין.`;
  }
  const next = (s.currentPlayerIndex + 1) % s.players.length;
  return {
    ...s,
    players: s.players.map(p => ({ ...p, calledLolos: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    selectedCards: [], equationResult: null, validTargets: [],
    activeOperation: keepOp ? s.activeOperation : null,
    activeFraction: null, identicalPlayCount: 0, hasPlayedCards: false,
    hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null,
    fractionPenalty: 0,
  };
}

function gameReducer(st: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const deck = shuffle(generateDeck(action.difficulty));
      const { hands, remaining } = dealCards(deck, action.players.length, CARDS_PER_PLAYER);
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
        ...initialState, phase: 'turn-transition', difficulty: action.difficulty,
        players: action.players.map((p, i) => ({ id: i, name: p.name, hand: hands[i], calledLolos: false })),
        drawPile, discardPile: firstDiscard ? [firstDiscard] : [],
      };
    }
    case 'NEXT_TURN': {
      const next = (st.currentPlayerIndex + 1) % st.players.length;
      return { ...st, players: st.players.map(p => ({ ...p, calledLolos: false })), currentPlayerIndex: next, phase: 'turn-transition', dice: null, selectedCards: [], equationResult: null, validTargets: [], message: '', activeOperation: null, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null, fractionPenalty: 0 };
    }
    case 'BEGIN_TURN': {
      if (st.activeOperation) {
        const cp = st.players[st.currentPlayerIndex];
        const has = cp.hand.some(c => (c.type === 'operation' && c.operation === st.activeOperation) || c.type === 'joker');
        if (has) return { ...st, phase: 'pre-roll', message: `פעולת ${st.activeOperation}! שחק/י קלף פעולה תואם או ג'וקר כדי להגן.` };
        let s = drawFromPile(st, 2, st.currentPlayerIndex);
        return { ...s, phase: 'pre-roll', activeOperation: null, message: `אין הגנה מפני ${st.activeOperation}! שלפת 2 קלפי עונשין.` };
      }
      if (st.pendingFractionTarget !== null) {
        return { ...st, phase: 'pre-roll', message: `התקפת שבר! נדרש: ${st.pendingFractionTarget}. הגן/י בקלף מספר, חסום/י בשבר, או שלוף/י ${st.fractionPenalty} קלפים.` };
      }
      return { ...st, phase: 'pre-roll', message: '' };
    }
    case 'ROLL_DICE': {
      if (st.phase !== 'pre-roll') return st;
      const dice = rollDiceUtil();
      let ns: GameState = { ...st, dice };
      if (isTriple(dice)) {
        let s = { ...ns, players: ns.players.map(p => ({ ...p, hand: [...p.hand] })) };
        for (let i = 0; i < s.players.length; i++) if (i !== st.currentPlayerIndex) s = drawFromPile(s, dice.die1, i);
        s.message = `שלישייה של ${dice.die1}! כל שאר השחקנים שולפים ${dice.die1} קלפים!`;
        ns = s;
      }
      const vt = generateValidTargets(dice);
      return { ...ns, validTargets: vt, phase: 'building', message: ns.message || '' };
    }
    case 'CONFIRM_EQUATION': {
      if (st.phase !== 'building') return st;
      return { ...st, phase: 'solved', equationResult: action.result, message: '' };
    }
    case 'CONFIRM_AND_DISCARD': {
      // Atomic confirm + discard — avoids double-dispatch race condition
      if (st.phase !== 'building') return st;
      if (st.pendingFractionTarget !== null) return st;
      if (st.hasPlayedCards || st.selectedCards.length === 0) return st;
      const cdNums = st.selectedCards.filter(c => c.type === 'number');
      if (cdNums.length !== st.selectedCards.length) return st;
      const cdSum = cdNums.reduce((s, c) => s + (c.value ?? 0), 0);
      if (cdSum !== action.result) return st;
      if (!st.validTargets.some(t => t.result === cdSum)) return st;
      const cdIds = new Set(st.selectedCards.map(c => c.id));
      const cdCp = st.players[st.currentPlayerIndex];
      const cdNp = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cdCp.hand.filter(c => !cdIds.has(c.id)) } : p);
      let cdNs: GameState = { ...st, phase: 'solved', equationResult: action.result, players: cdNp, discardPile: [...st.discardPile, ...st.selectedCards], selectedCards: [], identicalPlayCount: 0, hasPlayedCards: true, lastCardValue: cdNums[cdNums.length - 1].value ?? null, message: '' };
      cdNs = checkWin(cdNs);
      if (cdNs.phase === 'game-over') return cdNs;
      return endTurnLogic(cdNs);
    }
    case 'SELECT_CARD': {
      if (st.phase !== 'solved' && st.phase !== 'building') return st;
      if (st.hasPlayedCards) return st;
      const isSel = st.selectedCards.some(c => c.id === action.card.id);
      return { ...st, selectedCards: isSel ? st.selectedCards.filter(c => c.id !== action.card.id) : [...st.selectedCards, action.card], message: '' };
    }
    case 'DISCARD_AND_END': {
      if (st.phase !== 'solved') return st;
      if (st.hasPlayedCards || st.selectedCards.length === 0) return st;
      const nums = st.selectedCards.filter(c => c.type === 'number');
      if (nums.length !== st.selectedCards.length) return st;
      const sum = nums.reduce((s, c) => s + (c.value ?? 0), 0);
      if (st.equationResult !== null && sum !== st.equationResult) return st;
      if (!st.validTargets.some(t => t.result === sum)) return st;
      const ids = new Set(st.selectedCards.map(c => c.id));
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => !ids.has(c.id)) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, ...st.selectedCards], selectedCards: [], identicalPlayCount: 0, hasPlayedCards: true, lastCardValue: nums[nums.length - 1].value ?? null, message: '' };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns);
    }
    case 'PLAY_IDENTICAL': {
      if (st.phase !== 'pre-roll') return st;
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateIdenticalPlay(action.card, td)) return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], hasPlayedCards: true, lastCardValue: action.card.type === 'number' ? action.card.value ?? null : null, message: '' };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns);
    }
    case 'PLAY_OPERATION': {
      if (st.phase !== 'pre-roll' && st.phase !== 'solved' && st.phase !== 'building') return st;
      if (st.hasPlayedCards || action.card.type !== 'operation') return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.card.operation!, selectedCards: [], hasPlayedCards: true, message: '' };
      ns = checkWin(ns);
      return ns;
    }
    case 'PLAY_FRACTION': {
      if (st.hasPlayedCards) return st;
      if (action.card.type !== 'fraction') return st;
      const cp = st.players[st.currentPlayerIndex];
      const denom = fractionDenominator(action.card.fraction!);

      // ── BLOCK MODE: fraction-on-fraction during defense ──
      if (st.pendingFractionTarget !== null) {
        const newTarget = st.pendingFractionTarget / denom;
        const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
        let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], hasPlayedCards: true });
        if (ns.phase === 'game-over') return ns;
        const next = (ns.currentPlayerIndex + 1) % ns.players.length;
        return {
          ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
          currentPlayerIndex: next, phase: 'turn-transition', dice: null,
          selectedCards: [], equationResult: null, validTargets: [],
          activeOperation: null, activeFraction: null, identicalPlayCount: 0,
          hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
          pendingFractionTarget: newTarget, fractionPenalty: denom,
          message: `${cp.name} חסם/ה בשבר ${action.card.fraction}!`,
        };
      }

      // ── ATTACK MODE: fraction on a number card ──
      if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') return st;
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateFractionPlay(action.card, td)) return st;
      const newTarget = td.value! / denom;
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], hasPlayedCards: true });
      if (ns.phase === 'game-over') return ns;
      const next = (ns.currentPlayerIndex + 1) % ns.players.length;
      return {
        ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
        currentPlayerIndex: next, phase: 'turn-transition', dice: null,
        selectedCards: [], equationResult: null, validTargets: [],
        activeOperation: null, activeFraction: null, identicalPlayCount: 0,
        hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
        pendingFractionTarget: newTarget, fractionPenalty: denom,
        message: `${cp.name} שיחק/ה שבר ${action.card.fraction}!`,
      };
    }
    case 'DEFEND_FRACTION_SOLVE': {
      if (st.pendingFractionTarget === null) return st;
      if (action.card.type !== 'number' || action.card.value !== st.pendingFractionTarget) return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], pendingFractionTarget: null, fractionPenalty: 0, lastCardValue: action.card.value ?? null, message: 'הגנה מוצלחת!' });
      if (ns.phase === 'game-over') return ns;
      return { ...ns, phase: 'pre-roll', hasPlayedCards: false };
    }
    case 'DEFEND_FRACTION_PENALTY': {
      if (st.pendingFractionTarget === null) return st;
      const cp = st.players[st.currentPlayerIndex];
      let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
      s = { ...s, pendingFractionTarget: null, fractionPenalty: 0, message: `${cp.name} שלף/ה ${st.fractionPenalty} קלפי עונשין.` };
      return endTurnLogic(s);
    }
    case 'OPEN_JOKER_MODAL': return { ...st, jokerModalOpen: true, selectedCards: [action.card] };
    case 'CLOSE_JOKER_MODAL': return { ...st, jokerModalOpen: false, selectedCards: [] };
    case 'PLAY_JOKER': {
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.chosenOperation, selectedCards: [], jokerModalOpen: false, hasPlayedCards: true, message: '' };
      ns = checkWin(ns);
      return ns;
    }
    case 'DRAW_CARD': {
      if (st.hasPlayedCards || st.hasDrawnCard) return st;
      let s = reshuffleDiscard(st);
      if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: '' };
      const drawnCard = s.drawPile[0];
      s = drawFromPile(s, 1, s.currentPlayerIndex);
      s = { ...s, hasDrawnCard: true };
      return endTurnLogic(s);
    }
    case 'CALL_LOLOS': {
      const cp = st.players[st.currentPlayerIndex];
      if (cp.hand.length > 2) return st;
      return { ...st, players: st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, calledLolos: true } : p), message: `${cp.name} קרא/ה לולוס!` };
    }
    case 'END_TURN': return endTurnLogic(st);
    case 'SET_MESSAGE': return { ...st, message: action.message };
    case 'RESET_GAME': return initialState;
    default: return st;
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONTEXT
// ═══════════════════════════════════════════════════════════════

const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> }>({ state: initialState, dispatch: () => undefined });
function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}
function useGame() { return useContext(GameContext); }

// ═══════════════════════════════════════════════════════════════
//  BUTTON — gradient
// ═══════════════════════════════════════════════════════════════

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'gold';
type BtnSize = 'sm' | 'md' | 'lg';
const btnGrad: Record<BtnVariant, [string, string]> = { primary: ['#3B82F6','#1D4ED8'], secondary: ['#6B7280','#374151'], danger: ['#EF4444','#B91C1C'], success: ['#22C55E','#15803D'], gold: ['#FACC15','#CA8A04'] };
const btnTx: Record<BtnVariant, string> = { primary: '#FFF', secondary: '#FFF', danger: '#FFF', success: '#FFF', gold: '#000' };
const btnPd: Record<BtnSize, [number, number]> = { sm: [6,12], md: [10,16], lg: [14,24] };
const btnFs: Record<BtnSize, number> = { sm: 13, md: 15, lg: 17 };

function Btn({ variant='primary', size='md', children, onPress, disabled, style }: { variant?: BtnVariant; size?: BtnSize; children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any }) {
  const [pv,ph] = btnPd[size];
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      <LinearGradient colors={btnGrad[variant]} style={{ borderRadius: 10, paddingVertical: pv, paddingHorizontal: ph, alignItems: 'center', justifyContent: 'center' }}>
        {typeof children === 'string' ? <Text style={{ color: btnTx[variant], fontSize: btnFs[size], fontWeight: '700' }}>{children}</Text> : children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════

function AppModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mS.overlay}><View style={mS.box}>
        <View style={mS.header}><Text style={mS.title}>{title}</Text><TouchableOpacity onPress={onClose}><Text style={mS.close}>✕</Text></TouchableOpacity></View>
        <ScrollView style={{ flexGrow: 0 }}>{children}</ScrollView>
      </View></View>
    </RNModal>
  );
}
const mS = StyleSheet.create({ overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:20 }, box: { backgroundColor:'#1F2937', borderRadius:16, padding:20, width:'100%', maxHeight:'80%' }, header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 }, title: { color:'#FFF', fontSize:18, fontWeight:'700' }, close: { color:'#9CA3AF', fontSize:22 } });

// ═══════════════════════════════════════════════════════════════
//  3D SHADOW + GLOW HELPERS
// ═══════════════════════════════════════════════════════════════

const shadow3D = (color='#000', elev=10) => Platform.select({
  ios: { shadowColor: color, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 8 },
  android: { elevation: elev },
}) as any;

const glowActive = () => Platform.select({
  ios: { shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  android: { elevation: 14 },
}) as any;

// ═══════════════════════════════════════════════════════════════
//  BASE CARD — 3D plastic edge, active glow, thick colored border
// ═══════════════════════════════════════════════════════════════

function BaseCard({ children, gradient=['#FFFFFF','#F3F4F6'], edgeColor='#D1D5DB', borderColor, selected=false, active=false, onPress, faceDown=false, small=false }: {
  children: React.ReactNode; gradient?: [string,string]; edgeColor?: string; borderColor?: string; selected?: boolean; active?: boolean; onPress?: () => void; faceDown?: boolean; small?: boolean;
}) {
  const w = small ? 56 : 76;
  const h = small ? 80 : 110;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue:1, duration:200, useNativeDriver:true }).start(); }, []);

  // Face-down card (draw pile)
  if (faceDown) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[{ width:w, borderRadius:12, borderBottomWidth:6, borderBottomColor:'#1E1B4B' }, shadow3D('#000')]}>
        <LinearGradient colors={['#4338CA','#312E81']} style={{ width:w, height:h, borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:'rgba(129,140,248,0.3)' }}>
          <View style={{ width:30, height:30, borderRadius:15, borderWidth:2.5, borderColor:'rgba(165,180,252,0.5)' }} />
          <View style={{ position:'absolute', top:6, left:6, width:10, height:10, borderRadius:5, backgroundColor:'rgba(165,180,252,0.15)' }} />
          <View style={{ position:'absolute', bottom:6, right:6, width:10, height:10, borderRadius:5, backgroundColor:'rgba(165,180,252,0.15)' }} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  // Compute border/shadow for selected, active, or normal
  const outerBorderWidth = selected ? 3 : (borderColor ? 4 : 0);
  const outerBorderColor = selected ? '#FACC15' : (borderColor || 'transparent');
  const bottomEdge = selected ? '#B45309' : (active ? '#15803D' : edgeColor);
  const shadowStyle = active ? glowActive() : (selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10));

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: w, borderRadius: 12,
          borderBottomWidth: 6, borderBottomColor: bottomEdge,
          borderWidth: outerBorderWidth, borderColor: outerBorderColor,
          transform: [{ translateY: selected ? -8 : (active ? -4 : 0) }],
        }, shadowStyle]}>
          <LinearGradient colors={gradient} style={{ width: w - (outerBorderWidth * 2), height: h, borderRadius: outerBorderWidth > 0 ? 8 : 10, alignItems:'center', justifyContent:'center' }} start={{x:0.3,y:0}} end={{x:0.7,y:1}}>
            {children}
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DIE — gradient + 3D edge
// ═══════════════════════════════════════════════════════════════

const dotPos: Record<number,[number,number][]> = { 1:[[50,50]], 2:[[25,25],[75,75]], 3:[[25,25],[50,50],[75,75]], 4:[[25,25],[75,25],[25,75],[75,75]], 5:[[25,25],[75,25],[50,50],[25,75],[75,75]], 6:[[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]] };
const DS = 56;

function Die({ value, rolling }: { value: number|null; rolling?: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (rolling) { spin.setValue(0); Animated.timing(spin, { toValue:1, duration:600, useNativeDriver:true }).start(); } }, [rolling]);
  const rz = spin.interpolate({ inputRange:[0,1], outputRange:['0deg','720deg'] });
  const dots = value && !rolling ? dotPos[value] || [] : [];
  return (
    <Animated.View style={[{ width:DS, borderRadius:12, borderBottomWidth:4, borderBottomColor:'#9CA3AF', overflow:'hidden' }, shadow3D('#000',6), { transform:[{rotateZ: rz as any}] }]}>
      <LinearGradient colors={['#FFFFFF','#E5E7EB']} style={{ width:DS, height:DS, borderRadius:12, position:'relative' }}>
        {dots.length > 0
          ? dots.map(([x,y],i) => <View key={i} style={{ position:'absolute', width:12, height:12, borderRadius:6, backgroundColor:'#1F2937', left:(x/100)*DS-6, top:(y/100)*DS-6 }} />)
          : <Text style={{ position:'absolute', width:'100%', textAlign:'center', top:14, fontSize:22, fontWeight:'700', color:'#D1D5DB' }}>?</Text>}
      </LinearGradient>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CARD TYPE COMPONENTS — LinearGradient backgrounds
// ═══════════════════════════════════════════════════════════════

// Color scheme by number range: blue 0-9, green 10-19, red 20-25
function getNumStyle(v: number) {
  if (v <= 9) return { border:'#3B82F6', edge:'#1E40AF', text:'#1E3A8A' };
  if (v <= 19) return { border:'#22C55E', edge:'#166534', text:'#14532D' };
  return { border:'#EF4444', edge:'#991B1B', text:'#7F1D1D' };
}

function NumberCard({ card, selected, active, onPress, small }: { card: Card; selected?: boolean; active?: boolean; onPress?: () => void; small?: boolean }) {
  const v = card.value ?? 0; const cl = getNumStyle(v);
  return <BaseCard gradient={['#FFFFFF','#F8FAFC']} edgeColor={cl.edge} borderColor={small ? cl.border : undefined} selected={selected} active={active} onPress={onPress} small={small}>
    <View style={{alignItems:'center'}}>
      <Text style={{color:cl.text, fontSize:small?22:32, fontWeight:'900', letterSpacing:-1}}>{v}</Text>
      {!small && <Text style={{color:cl.text,fontSize:8,marginTop:2,opacity:0.5,fontWeight:'700'}}>מספר</Text>}
    </View>
  </BaseCard>;
}

const fDisp: Record<string,{n:string;d:string;s:string}> = { '1/2':{n:'1',d:'2',s:'½'}, '1/3':{n:'1',d:'3',s:'⅓'}, '1/4':{n:'1',d:'4',s:'¼'}, '1/5':{n:'1',d:'5',s:'⅕'} };

function FractionCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const f = fDisp[card.fraction ?? '1/2'];
  return <BaseCard gradient={['#EDE9FE','#DDD6FE']} edgeColor="#4C1D95" borderColor={small ? '#8B5CF6' : undefined} selected={selected} onPress={onPress} small={small}>
    <View style={{alignItems:'center'}}>{small
      ? <Text style={{color:'#5B21B6',fontSize:22,fontWeight:'900'}}>{f.s}</Text>
      : <><Text style={{color:'#5B21B6',fontSize:22,fontWeight:'900',lineHeight:26}}>{f.n}</Text><View style={{width:26,height:3,backgroundColor:'#7C3AED',marginVertical:2,borderRadius:2}} /><Text style={{color:'#5B21B6',fontSize:22,fontWeight:'900',lineHeight:26}}>{f.d}</Text><Text style={{color:'#7C3AED',fontSize:8,marginTop:2,opacity:0.6,fontWeight:'700'}}>שבר</Text></>
    }</View>
  </BaseCard>;
}

function OperationCardComp({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return <BaseCard gradient={['#FFF7ED','#FFEDD5']} edgeColor="#7C2D12" borderColor={small ? '#F97316' : undefined} selected={selected} onPress={onPress} small={small}>
    <View style={{alignItems:'center'}}><Text style={{color:'#9A3412',fontSize:small?24:38,fontWeight:'900'}}>{card.operation}</Text>{!small && <Text style={{color:'#C2410C',fontSize:8,marginTop:2,opacity:0.6,fontWeight:'700'}}>פעולה</Text>}</View>
  </BaseCard>;
}

function JokerCard({ card:_c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return <BaseCard gradient={['#FFFBEB','#FEF3C7']} edgeColor="#78350F" borderColor={small ? '#EAB308' : undefined} selected={selected} onPress={onPress} small={small}>
    <View style={{alignItems:'center'}}><Text style={{color:'#92400E',fontSize:small?18:28}}>★</Text><Text style={{color:'#78350F',fontSize:small?10:14,fontWeight:'900'}}>ג'וקר</Text></View>
  </BaseCard>;
}

function GameCard({ card, selected, active, onPress, small }: { card: Card; selected?: boolean; active?: boolean; onPress?: () => void; small?: boolean }) {
  switch (card.type) {
    case 'number': return <NumberCard card={card} selected={selected} active={active} onPress={onPress} small={small} />;
    case 'fraction': return <FractionCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'operation': return <OperationCardComp card={card} selected={selected} onPress={onPress} small={small} />;
    case 'joker': return <JokerCard card={card} selected={selected} onPress={onPress} small={small} />;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DRAW PILE — 4-layer messy 3D stack
// ═══════════════════════════════════════════════════════════════

const pileRotations = [
  { rotate: '-3deg', translateX: -2, translateY: 4 },
  { rotate: '2deg', translateX: 3, translateY: 2 },
  { rotate: '-1deg', translateX: -1, translateY: 1 },
  { rotate: '0deg', translateX: 0, translateY: 0 },
];

function DrawPile() {
  const { state, dispatch } = useGame();
  const canDraw = (state.phase === 'pre-roll' || state.phase === 'building') && !state.hasPlayedCards && state.pendingFractionTarget === null;
  const count = state.drawPile.length;
  const layers = Math.min(count, 4);
  return (
    <View style={{ alignItems:'center' }}>
      <View style={{ width:90, height:130, alignItems:'center', justifyContent:'center' }}>
        {layers > 0 ? pileRotations.slice(4 - layers).map((r, i) => {
          const isTop = i === layers - 1;
          return (
            <View key={i} style={{ position:'absolute', transform:[{rotate:r.rotate},{translateX:r.translateX},{translateY:r.translateY}] }}>
              <BaseCard faceDown small onPress={isTop && canDraw ? () => dispatch({ type:'DRAW_CARD' }) : undefined}><></></BaseCard>
            </View>
          );
        }) : <View style={dpS.empty}><Text style={{color:'#6B7280',fontSize:10}}>ריק</Text></View>}
      </View>
      <Text style={{color:'#6B7280',fontSize:10,marginTop:2}}>{count}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DISCARD PILE — 3-layer messy stack showing top card
// ═══════════════════════════════════════════════════════════════

const discardRotations = [
  { rotate: '4deg', translateX: 2, translateY: 3 },
  { rotate: '-2deg', translateX: -1, translateY: 1 },
  { rotate: '0deg', translateX: 0, translateY: 0 },
];

function DiscardPile() {
  const { state } = useGame();
  const pileSize = state.discardPile.length;
  const top = pileSize > 0 ? state.discardPile[pileSize - 1] : null;
  const layers = Math.min(pileSize, 3);
  return (
    <View style={{ alignItems:'center', gap:4 }}>
      <View style={{ width:90, height:130, alignItems:'center', justifyContent:'center' }}>
        {layers > 0 ? discardRotations.slice(3 - layers).map((r, i) => {
          const isTop = i === layers - 1;
          return (
            <View key={i} style={{ position:'absolute', transform:[{rotate:r.rotate},{translateX:r.translateX},{translateY:r.translateY}] }}>
              {isTop && top ? <GameCard card={top} active /> : <BaseCard faceDown small><></></BaseCard>}
            </View>
          );
        }) : <View style={dpS.empty}><Text style={{color:'#6B7280',fontSize:11}}>ריק</Text></View>}
      </View>
      <Text style={{color:'#9CA3AF',fontSize:11}}>ערימה</Text>
    </View>
  );
}
const dpS = StyleSheet.create({ empty: { width:76, height:110, borderRadius:12, borderWidth:2, borderStyle:'dashed', borderColor:'#4B5563', alignItems:'center', justifyContent:'center' } });

// ═══════════════════════════════════════════════════════════════
//  DICE AREA
// ═══════════════════════════════════════════════════════════════

function DiceArea() {
  const { state, dispatch } = useGame();
  const [rolling, setRolling] = useState(false);
  const handleRoll = () => { if (state.phase !== 'pre-roll') return; setRolling(true); setTimeout(() => { dispatch({ type:'ROLL_DICE' }); setRolling(false); }, 600); };
  return (
    <View style={{alignItems:'center',gap:10}}>
      <View style={{flexDirection:'row',gap:12}}>
        <Die value={state.dice?.die1 ?? null} rolling={rolling} />
        <Die value={state.dice?.die2 ?? null} rolling={rolling} />
        <Die value={state.dice?.die3 ?? null} rolling={rolling} />
      </View>
      {state.phase === 'pre-roll' && !state.hasPlayedCards && state.pendingFractionTarget === null && <Btn onPress={handleRoll} variant="primary" disabled={rolling}>{rolling ? 'מגלגל...' : 'הטל קוביות'}</Btn>}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CELEBRATION (Joker rainbow)
// ═══════════════════════════════════════════════════════════════

const RAINBOW = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6'];
function CelebrationFlash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const colorIdx = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.sequence([Animated.timing(colorIdx,{toValue:RAINBOW.length-1,duration:800,useNativeDriver:false}),Animated.timing(opacity,{toValue:0,duration:300,useNativeDriver:false})]).start(()=>onDone()); }, []);
  const bg = colorIdx.interpolate({inputRange:RAINBOW.map((_,i)=>i),outputRange:RAINBOW});
  return <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:bg as any,opacity:opacity as any}]} pointerEvents="none"><View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:60,fontWeight:'900',color:'#FFF'}}>★ ג'וקר! ★</Text></View></Animated.View>;
}

// ═══════════════════════════════════════════════════════════════
//  EQUATION BUILDER
// ═══════════════════════════════════════════════════════════════

const SLOT_SZ = 46; const OP_SZ = 34;

function EquationBuilder() {
  const { state, dispatch } = useGame();
  const [slots, setSlots] = useState<(number|null)[]>([null,null,null]);
  const [op1, setOp1] = useState('+');
  const [op2, setOp2] = useState('+');
  const [selectedDie, setSelectedDie] = useState<number|null>(null);
  const diceKey = state.dice ? `${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  useEffect(() => { setSlots([null,null,null]); setOp1('+'); setOp2('+'); setSelectedDie(null); }, [diceKey]);
  if (state.phase !== 'building' || !state.dice || state.activeOperation || state.pendingFractionTarget !== null) return null;
  const dv = [state.dice.die1, state.dice.die2, state.dice.die3];
  const placed = new Set(slots.filter((s):s is number => s!==null));
  const pool = [0,1,2].filter(i => !placed.has(i));
  const hPool = (di:number) => { if (selectedDie===di){setSelectedDie(null);return;} const fe=slots.findIndex(s=>s===null); if(fe!==-1){const n=[...slots];n[fe]=di;setSlots(n);setSelectedDie(null);}else{setSelectedDie(di);} };
  const hSlot = (si:number) => { if(slots[si]!==null){const n=[...slots];n[si]=null;setSlots(n);return;} if(selectedDie!==null){const n=[...slots];n[si]=selectedDie;setSlots(n);setSelectedDie(null);} };
  const cyc = (c:string) => { const idx = EQ_OPS_STR.indexOf(c); return EQ_OPS_STR[idx === -1 ? 0 : (idx + 1) % EQ_OPS_STR.length]; };
  const sv = (i:number):number|null => { try { return slots[i]!==null?dv[slots[i]!]:null; } catch { return null; } };
  const cr = getCurrentResult(sv(0),op1,sv(1),op2,sv(2));
  const sn = state.selectedCards.filter(c=>c.type==='number');
  const tc = sn.reduce((s,c)=>s+(c.value??0),0);
  const ok = cr!==null && Number.isFinite(cr) && sn.length>0 && cr===tc && state.validTargets.some(t=>t.result===cr);
  // Single atomic dispatch — prevents double-dispatch race condition that caused freeze
  const hConfirm = () => { if(!ok || cr===null) return; dispatch({type:'CONFIRM_AND_DISCARD',result:cr}); };

  const renderSlot = (i:number) => (
    <TouchableOpacity key={`s${i}`} style={[eqS.slot, sv(i)===null?eqS.slotEmpty:eqS.slotFilled]} onPress={()=>hSlot(i)} activeOpacity={0.7}>
      {sv(i)!==null && <Text style={eqS.slotVal}>{sv(i)}</Text>}
    </TouchableOpacity>
  );
  const opDisplay: Record<string,string> = { '+':'+', '-':'-', '*':'×', '/':'÷' };
  const renderOp = (v:string,set:(v:string)=>void,k:string) => (
    <TouchableOpacity key={k} onPress={()=>set(cyc(v))} activeOpacity={0.7}>
      <LinearGradient colors={['#FB923C','#EA580C']} style={eqS.opC}><Text style={eqS.opT}>{opDisplay[v] ?? v}</Text></LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={eqS.wrap}>
      <Text style={eqS.title}>בנה/י משוואה מהקוביות</Text>
      <View style={eqS.poolR}>
        {pool.map(i => (
          <TouchableOpacity key={`p${i}`} style={[eqS.pDie, selectedDie===i&&eqS.pDieSel]} onPress={()=>hPool(i)} activeOpacity={0.7}>
            <LinearGradient colors={['#FFF','#DBEAFE']} style={eqS.pDieIn}><Text style={eqS.pDieT}>{dv[i]}</Text></LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
      <View style={eqS.eqR}>
        {renderSlot(0)}{renderOp(op1,setOp1,'o1')}{renderSlot(1)}{renderOp(op2,setOp2,'o2')}{renderSlot(2)}
        <Text style={eqS.eq}>=</Text>
        <View style={[eqS.rBox, cr!==null&&eqS.rBoxOk]}><Text style={eqS.rT}>{cr!==null?cr:'?'}</Text></View>
        <TouchableOpacity onPress={hConfirm} disabled={!ok} activeOpacity={0.7}>
          <LinearGradient colors={ok?['#22C55E','#15803D']:['#4B5563','#374151']} style={[eqS.cBtn, !ok&&{opacity:0.5}]}><Text style={eqS.cT}>אשר</Text></LinearGradient>
        </TouchableOpacity>
      </View>
      {state.validTargets.length>0 && <Text style={eqS.hint}>תוצאות אפשריות: {state.validTargets.map(t=>t.result).join(', ')}</Text>}
    </View>
  );
}
const eqS = StyleSheet.create({
  wrap:{backgroundColor:'rgba(31,41,55,0.7)',borderRadius:14,padding:14,alignItems:'center',gap:10,borderWidth:1,borderColor:'rgba(75,85,99,0.4)'},
  title:{color:'#93C5FD',fontSize:14,fontWeight:'800',textAlign:'center'},
  poolR:{flexDirection:'row',gap:10,justifyContent:'center',alignItems:'center',minHeight:42},
  pDie:{width:42,height:42,borderRadius:10,borderWidth:2,borderColor:'#93C5FD',overflow:'hidden'},
  pDieSel:{borderColor:'#FACC15',borderWidth:2.5},
  pDieIn:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},
  pDieT:{fontSize:18,fontWeight:'800',color:'#1E40AF'},
  eqR:{flexDirection:'row',direction:'ltr' as any,alignItems:'center',gap:5},
  slot:{width:SLOT_SZ,height:SLOT_SZ,borderRadius:10,alignItems:'center',justifyContent:'center'},
  slotEmpty:{backgroundColor:'rgba(55,65,81,0.4)',borderWidth:2,borderStyle:'dashed',borderColor:'#6B7280'},
  slotFilled:{backgroundColor:'#FFF',borderWidth:2,borderColor:'#3B82F6'},
  slotVal:{fontSize:20,fontWeight:'900',color:'#1F2937'},
  opC:{width:OP_SZ,height:OP_SZ,borderRadius:OP_SZ/2,alignItems:'center',justifyContent:'center'},
  opT:{fontSize:16,fontWeight:'800',color:'#FFF'},
  eq:{fontSize:22,fontWeight:'900',color:'#9CA3AF',marginHorizontal:2},
  rBox:{width:SLOT_SZ,height:SLOT_SZ,borderRadius:10,backgroundColor:'#1F2937',borderWidth:2,borderColor:'#4B5563',alignItems:'center',justifyContent:'center'},
  rBoxOk:{borderColor:'#22C55E'},
  rT:{color:'#FFF',fontSize:20,fontWeight:'900'},
  cBtn:{paddingHorizontal:14,height:SLOT_SZ,borderRadius:10,alignItems:'center',justifyContent:'center'},
  cT:{color:'#FFF',fontSize:13,fontWeight:'700'},
  hint:{color:'#6B7280',fontSize:11,textAlign:'center'},
});

// ═══════════════════════════════════════════════════════════════
//  ACTION BAR
// ═══════════════════════════════════════════════════════════════

function ActionBar() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex]; if (!cp) return null;
  const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved', hp=state.hasPlayedCards;
  const opCh=pr&&!!state.activeOperation&&!hp;
  const hasFracDefense = state.pendingFractionTarget !== null;
  const sn=state.selectedCards.filter(c=>c.type==='number');
  const ss=sn.reduce((s,c)=>s+(c.value??0),0);
  const canDis=so&&!hp&&sn.length>0&&sn.length===state.selectedCards.length;
  const canLol=(pr||bl||so)&&cp.hand.length<=2&&!cp.calledLolos&&!opCh&&!hasFracDefense;
  return (
    <View style={{width:'100%',gap:10}}>
      {opCh && !hasFracDefense && <View style={aS.opS}><Text style={aS.opT}>אתגר פעולה: {state.activeOperation}</Text><Text style={aS.opH}>הגן/י עם קלף פעולה תואם או ג'וקר.</Text><Btn variant="danger" size="sm" onPress={()=>dispatch({type:'END_TURN'})}>קבל/י עונש</Btn></View>}
      {hasFracDefense && <View style={aS.opS}><Text style={aS.opT}>התקפת שבר! נדרש: {state.pendingFractionTarget}</Text><Text style={{color:'#FDBA74',fontSize:11,marginBottom:6}}>הנח קלף מספר {state.pendingFractionTarget} להגנה, שבר לחסימה, או קבל עונש.</Text><Btn variant="danger" size="sm" onPress={()=>dispatch({type:'DEFEND_FRACTION_PENALTY'})}>{`שלוף ${state.fractionPenalty} קלפי עונשין`}</Btn></View>}
      {bl&&!hp&&!hasFracDefense && <View style={{flexDirection:'row',gap:8}}><Btn variant="secondary" size="sm" onPress={()=>dispatch({type:'DRAW_CARD'})}>שלוף קלף (ויתור)</Btn></View>}
      {canDis&&!hasFracDefense && <View style={{flexDirection:'row',gap:8}}><Btn variant="success" onPress={()=>dispatch({type:'DISCARD_AND_END'})}>{`אשר והנח (${ss})`}</Btn></View>}
      {(pr||so)&&hp&&!hasFracDefense && <View style={{flexDirection:'row',gap:8}}><Btn variant="secondary" onPress={()=>dispatch({type:'END_TURN'})}>סיים תור</Btn></View>}
      {canLol && <View style={{flexDirection:'row',gap:8}}><Btn variant="gold" size="lg" onPress={()=>dispatch({type:'CALL_LOLOS'})}>לולוס!</Btn></View>}
      {!!state.message && <View style={aS.msg}><Text style={aS.msgT}>{state.message}</Text></View>}
      <AppModal visible={state.jokerModalOpen} onClose={()=>dispatch({type:'CLOSE_JOKER_MODAL'})} title="בחר/י פעולה לג'וקר">
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center'}}>
          {(['+','-','x','÷'] as Operation[]).map(op => <Btn key={op} variant="primary" size="lg" onPress={()=>{const j=state.selectedCards[0];if(j)dispatch({type:'PLAY_JOKER',card:j,chosenOperation:op});}} style={{width:'45%',minWidth:100}}>{op}</Btn>)}
        </View>
      </AppModal>
    </View>
  );
}
const aS = StyleSheet.create({ opS:{backgroundColor:'rgba(154,52,18,0.2)',borderWidth:1,borderColor:'rgba(249,115,22,0.3)',borderRadius:10,padding:12}, opT:{color:'#FDBA74',fontSize:13,fontWeight:'600',marginBottom:4}, opH:{color:'#9CA3AF',fontSize:11,marginBottom:8}, msg:{backgroundColor:'rgba(234,179,8,0.1)',borderRadius:10,padding:10,alignItems:'center'}, msgT:{color:'#FDE68A',fontSize:13,textAlign:'center'} });

// ═══════════════════════════════════════════════════════════════
//  PLAYER HAND
// ═══════════════════════════════════════════════════════════════

function PlayerHand() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex]; if(!cp) return null;
  const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved';
  const td = state.discardPile[state.discardPile.length-1];
  const opCh=pr&&!!state.activeOperation&&!state.hasPlayedCards;
  const hasFracDefense = state.pendingFractionTarget !== null;
  const sorted = [...cp.hand].sort((a,b) => { const o={number:0,fraction:1,operation:2,joker:3} as const; if(o[a.type]!==o[b.type]) return o[a.type]-o[b.type]; if(a.type==='number'&&b.type==='number') return (a.value??0)-(b.value??0); return 0; });

  const tap = (card:Card) => {
    if (state.hasPlayedCards) return;

    // ── Fraction defense: ONLY solve (number) or block (fraction) allowed ──
    if (hasFracDefense) {
      if (card.type === 'number' && card.value === state.pendingFractionTarget) {
        dispatch({ type: 'DEFEND_FRACTION_SOLVE', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      // Operators, jokers, non-matching numbers — all BANNED during fraction attack
      return;
    }

    if (pr) {
      if (opCh) { if(card.type==='operation'&&card.operation===state.activeOperation) dispatch({type:'PLAY_OPERATION',card}); else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card}); return; }
      if (validateIdenticalPlay(card,td)) dispatch({type:'PLAY_IDENTICAL',card}); return;
    }
    if (bl||so) {
      if(card.type==='number') dispatch({type:'SELECT_CARD',card});
      else if(card.type==='fraction') dispatch({type:'PLAY_FRACTION',card});
      else if(card.type==='operation') dispatch({type:'PLAY_OPERATION',card});
      else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card});
    }
  };

  return (
    <View style={{width:'100%'}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8}}>
        <Text style={{color:'#D1D5DB',fontSize:13,fontWeight:'600'}}>היד של {cp.name}</Text>
        <Text style={{color:'#6B7280',fontSize:11}}>({cp.hand.length} קלפים)</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingHorizontal:4,paddingBottom:4}}>
        {sorted.map(card => <GameCard key={card.id} card={card} selected={state.selectedCards.some(c=>c.id===card.id)} small onPress={()=>tap(card)} />)}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  START SCREEN
// ═══════════════════════════════════════════════════════════════

function StartScreen() {
  const { dispatch } = useGame();
  const [pc,setPc]=useState(2); const [names,setNames]=useState<string[]>(Array(10).fill('')); const [diff,setDiff]=useState<'easy'|'full'>('full'); const [rules,setRules]=useState(false);
  const mx = diff==='easy'?8:10;
  return (
    <LinearGradient colors={['#0F172A','#1E293B']} style={{flex:1}}>
      <ScrollView contentContainerStyle={{padding:24,paddingTop:60,alignItems:'center'}} keyboardShouldPersistTaps="handled">
        <Text style={{fontSize:48,fontWeight:'900',color:'#F59E0B',letterSpacing:4}}>לולוס</Text>
        <Text style={{color:'#9CA3AF',fontSize:13,marginTop:4,marginBottom:28}}>משחק קלפים חשבוני חינוכי</Text>
        <Text style={ssS.label}>מספר שחקנים</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,alignSelf:'flex-start'}}>
          {Array.from({length:mx-1},(_,i)=>i+2).map(n => <TouchableOpacity key={n} onPress={()=>setPc(n)} style={[ssS.cBtn,pc===n&&ssS.cAct]}><Text style={[ssS.cTxt,pc===n&&{color:'#FFF'}]}>{n}</Text></TouchableOpacity>)}
        </View>
        <Text style={ssS.label}>שמות השחקנים</Text>
        {Array.from({length:pc},(_,i) => <TextInput key={i} placeholder={`שחקן ${i+1}`} placeholderTextColor="#6B7280" value={names[i]} onChangeText={t=>{const n=[...names];n[i]=t;setNames(n);}} style={ssS.inp} textAlign="right" />)}
        <Text style={ssS.label}>רמת קושי</Text>
        <View style={{flexDirection:'row',gap:10,width:'100%'}}>
          <TouchableOpacity style={[ssS.dBtn,diff==='easy'&&{backgroundColor:'#16A34A'}]} onPress={()=>{setDiff('easy');setPc(c=>Math.min(c,8));}}><Text style={[ssS.dTxt,diff==='easy'&&{color:'#FFF'}]}>קל (0-12)</Text></TouchableOpacity>
          <TouchableOpacity style={[ssS.dBtn,diff==='full'&&{backgroundColor:'#DC2626'}]} onPress={()=>setDiff('full')}><Text style={[ssS.dTxt,diff==='full'&&{color:'#FFF'}]}>מלא (0-25)</Text></TouchableOpacity>
        </View>
        <Btn variant="success" size="lg" onPress={()=>{const p=Array.from({length:pc},(_,i)=>({name:names[i].trim()||`שחקן ${i+1}`}));dispatch({type:'START_GAME',players:p,difficulty:diff});}} style={{width:'100%',marginTop:12}}>התחל משחק</Btn>
        <Btn variant="secondary" size="sm" onPress={()=>setRules(!rules)} style={{width:'100%',marginTop:8}}>{rules?'הסתר חוקים':'איך משחקים?'}</Btn>
        {rules && <View style={ssS.rBox}><Text style={ssS.rTitle}>איך משחקים לולוס</Text>
          {['כל שחקן מקבל 10 קלפים. הראשון שמרוקן את היד — מנצח!','הטל 3 קוביות וצור מספר יעד באמצעות חשבון (הקובייה השלישית אופציונלית).','בחר/י קלפי מספר מהיד שסכומם שווה לתוצאת המשוואה — ולחצ/י אשר.','לפני הטלת קוביות: אם יש קלף תואם לערימה — לחץ עליו לסיום תור.','קלפי שבר (1/2, 1/3, 1/4, 1/5): מחלקים את הקלף העליון ומכריחים את היריב להגן.','כשנותר 1-2 קלפים — לחץ "לולוס!" לפני שתסיים, אחרת תשלוף עונשין.'].map((r,i) => <Text key={i} style={ssS.rItem}>{i+1}. {r}</Text>)}
        </View>}
      </ScrollView>
    </LinearGradient>
  );
}
const ssS = StyleSheet.create({ label:{color:'#D1D5DB',fontSize:13,fontWeight:'600',alignSelf:'flex-start',marginBottom:8,marginTop:16}, cBtn:{width:36,height:36,borderRadius:8,backgroundColor:'#374151',alignItems:'center',justifyContent:'center'}, cAct:{backgroundColor:'#2563EB'}, cTxt:{color:'#D1D5DB',fontWeight:'700',fontSize:14}, inp:{width:'100%',backgroundColor:'#374151',borderWidth:1,borderColor:'#4B5563',borderRadius:10,paddingHorizontal:14,paddingVertical:10,color:'#FFF',fontSize:14,marginBottom:6}, dBtn:{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:'#374151',alignItems:'center'}, dTxt:{color:'#D1D5DB',fontWeight:'600',fontSize:14}, rBox:{marginTop:16,backgroundColor:'rgba(55,65,81,0.5)',borderRadius:10,padding:16,width:'100%'}, rTitle:{color:'#FFF',fontWeight:'700',fontSize:15,marginBottom:10,textAlign:'right'}, rItem:{color:'#D1D5DB',fontSize:12,marginBottom:6,lineHeight:20,textAlign:'right'} });

// ═══════════════════════════════════════════════════════════════
//  TURN TRANSITION
// ═══════════════════════════════════════════════════════════════

function TurnTransition() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  return (
    <LinearGradient colors={['#0F172A','#1E293B']} style={{flex:1,justifyContent:'center',alignItems:'center',padding:32}}>
      <TouchableOpacity style={{position:'absolute',top:54,right:20,backgroundColor:'#DC2626',paddingHorizontal:20,paddingVertical:10,borderRadius:10}} onPress={()=>dispatch({type:'RESET_GAME'})}><Text style={{color:'#FFF',fontSize:16,fontWeight:'700'}}>יציאה</Text></TouchableOpacity>
      <Text style={{color:'#9CA3AF',fontSize:14}}>העבר/י את המכשיר ל</Text>
      <Text style={{color:'#FFF',fontSize:32,fontWeight:'800',marginTop:8}}>{cp?.name}</Text>
      <Text style={{color:'#6B7280',fontSize:12,marginTop:8}}>{cp?.hand.length} קלפים ביד</Text>
      {!!state.message && <View style={{backgroundColor:'rgba(234,179,8,0.1)',borderRadius:10,padding:12,marginTop:16,width:'100%'}}><Text style={{color:'#FDE68A',fontSize:13,textAlign:'center'}}>{state.message}</Text></View>}
      <Btn variant="primary" size="lg" onPress={()=>dispatch({type:'BEGIN_TURN'})} style={{width:'100%',marginTop:24}}>אני מוכן/ה</Btn>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAME SCREEN
// ═══════════════════════════════════════════════════════════════

function PlayerInfo() {
  const { state } = useGame();
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{state.players.map((p,i) => <View key={p.id} style={[{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(55,65,81,0.5)',borderRadius:8,paddingHorizontal:10,paddingVertical:5}, i===state.currentPlayerIndex&&{backgroundColor:'rgba(59,130,246,0.25)',borderWidth:1,borderColor:'rgba(59,130,246,0.4)'}]}><Text style={[{color:'#9CA3AF',fontSize:12,fontWeight:'600',maxWidth:80}, i===state.currentPlayerIndex&&{color:'#FFF'}]} numberOfLines={1}>{p.name}</Text><Text style={{color:'#6B7280',fontSize:11,fontWeight:'700'}}>{p.hand.length}</Text></View>)}</View>;
}

function GameScreen() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  const [showCel,setShowCel] = useState(false);
  const prevJ = useRef(state.jokerModalOpen);
  useEffect(() => { if(prevJ.current&&!state.jokerModalOpen&&state.hasPlayedCards) setShowCel(true); prevJ.current=state.jokerModalOpen; }, [state.jokerModalOpen,state.hasPlayedCards]);
  return (
    <LinearGradient colors={['#0F172A','#1E293B']} style={{flex:1,paddingTop:50}}>
      <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingBottom:8,gap:10}}>
        <TouchableOpacity style={{backgroundColor:'#DC2626',paddingHorizontal:14,paddingVertical:6,borderRadius:8}} onPress={()=>dispatch({type:'RESET_GAME'})}><Text style={{color:'#FFF',fontSize:13,fontWeight:'700'}}>יציאה</Text></TouchableOpacity>
        <Text style={{color:'#F59E0B',fontSize:20,fontWeight:'900',letterSpacing:2,flex:1,textAlign:'center'}}>לולוס</Text>
        <Text style={{color:'#D1D5DB',fontSize:13}}>תורו/ה של <Text style={{color:'#FFF',fontWeight:'700'}}>{cp?.name}</Text></Text>
      </View>
      <ScrollView style={{flex:1}} contentContainerStyle={{padding:12,gap:14,paddingBottom:20}} showsVerticalScrollIndicator={false}>
        <PlayerInfo />

        {/* ── Fraction Attack Warning Banner ── */}
        {state.pendingFractionTarget !== null && (
          <LinearGradient colors={['#7C2D12','#9A3412']} style={{borderRadius:12,padding:14,borderWidth:2,borderColor:'#F97316',alignItems:'center',gap:6}}>
            <Text style={{color:'#FFF',fontSize:22,fontWeight:'900'}}>⚠️ הותקפת!</Text>
            <Text style={{color:'#FDE68A',fontSize:16,fontWeight:'700',textAlign:'center'}}>
              הנח קלף {state.pendingFractionTarget} או חסום עם שבר
            </Text>
            <Text style={{color:'#FDBA74',fontSize:12,textAlign:'center'}}>
              עונש: שליפת {state.fractionPenalty} קלפים
            </Text>
          </LinearGradient>
        )}

        {/* ── Centered Target Card Stack ── */}
        <View style={{alignItems:'center',gap:6}}>
          <Text style={{color:'#9CA3AF',fontSize:13,fontWeight:'600',textAlign:'center'}}>קלפים שנותרו בחבילה: {state.drawPile.length}</Text>
          <DiscardPile />
        </View>

        <DiceArea /><EquationBuilder /><ActionBar />
      </ScrollView>
      <View style={{backgroundColor:'rgba(15,23,42,0.8)',paddingHorizontal:12,paddingVertical:10,paddingBottom:24,borderTopWidth:1,borderTopColor:'rgba(75,85,99,0.3)'}}><PlayerHand /></View>
      {showCel && <CelebrationFlash onDone={()=>setShowCel(false)} />}
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAME OVER + CONFETTI
// ═══════════════════════════════════════════════════════════════

const CC = ['#EAB308','#3B82F6','#EF4444','#22C55E','#8B5CF6','#F97316'];
function Confetti() {
  const an = useRef(Array.from({length:30},()=>({x:new Animated.Value(Math.random()*SCREEN_W),y:new Animated.Value(-20),r:new Animated.Value(0),c:CC[Math.floor(Math.random()*CC.length)]}))).current;
  useEffect(()=>{an.forEach(a=>{const d=2000+Math.random()*2000,dl=Math.random()*1500;Animated.parallel([Animated.timing(a.y,{toValue:SCREEN_H+20,duration:d,delay:dl,useNativeDriver:true}),Animated.timing(a.r,{toValue:Math.random()*720-360,duration:d,delay:dl,useNativeDriver:true})]).start();});}, []);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{an.map((a,i)=><Animated.View key={i} style={{position:'absolute',width:10,height:10,borderRadius:2,backgroundColor:a.c,transform:[{translateX:a.x as any},{translateY:a.y as any},{rotateZ:a.r.interpolate({inputRange:[-360,360],outputRange:['-360deg','360deg']}) as any}]}} />)}</View>;
}

function GameOver() {
  const { state, dispatch } = useGame();
  const sorted = [...state.players].sort((a,b)=>a.hand.length-b.hand.length);
  return (
    <LinearGradient colors={['#0F172A','#1E293B']} style={{flex:1,justifyContent:'center',alignItems:'center',padding:32}}>
      <Confetti />
      <Text style={{fontSize:56,marginBottom:8}}>🏆</Text>
      <Text style={{color:'#FFF',fontSize:28,fontWeight:'800'}}>המשחק נגמר!</Text>
      <Text style={{color:'#FACC15',fontSize:20,fontWeight:'700',marginTop:8,marginBottom:24}}>{state.winner?.name} ניצח/ה!</Text>
      <View style={{backgroundColor:'rgba(55,65,81,0.5)',borderRadius:12,padding:16,width:'100%'}}>
        <Text style={{color:'#9CA3AF',fontSize:11,fontWeight:'700',letterSpacing:1,marginBottom:10,textAlign:'right'}}>תוצאות סופיות</Text>
        {sorted.map((p,i)=><View key={p.id} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:3}}><Text style={{color:'#D1D5DB',fontSize:14}}>{i+1}. {p.name}{p.hand.length===0?' ★':''}</Text><Text style={{color:'#9CA3AF',fontSize:14}}>{p.hand.length} קלפים נותרו</Text></View>)}
      </View>
      <Btn variant="success" size="lg" onPress={()=>dispatch({type:'RESET_GAME'})} style={{width:'100%',marginTop:20}}>שחק/י שוב</Btn>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER + APP + REGISTER
// ═══════════════════════════════════════════════════════════════

function GameRouter() {
  const { state } = useGame();
  switch (state.phase) {
    case 'setup': return <StartScreen />;
    case 'turn-transition': return <TurnTransition />;
    case 'pre-roll': case 'building': case 'solved': return <GameScreen />;
    case 'game-over': return <GameOver />;
    default: return <StartScreen />;
  }
}

function App() {
  return <GameProvider><StatusBar style="light" /><GameRouter /></GameProvider>;
}

registerRootComponent(App);
