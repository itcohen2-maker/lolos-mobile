// ============================================================
// index.tsx — Lolos Card Game — SINGLE FILE
// ============================================================

import React, { useState, useEffect, useRef, createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  I18nManager, View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Modal as RNModal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
  | { type: 'SELECT_CARD'; card: Card }
  | { type: 'DISCARD_AND_END' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'PLAY_OPERATION'; card: Card }
  | { type: 'PLAY_FRACTION'; card: Card }
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

// getCurrentResult: (Slot1 [Op1] Slot2) then optionally ([Result] [Op2] Slot3)
function getCurrentResult(
  s1: number | null, op1: string, s2: number | null, op2: string, s3: number | null,
): number | null {
  const calc = (x: number, op: string, y: number): number | null => {
    switch (op) {
      case '+': return x + y; case '-': return x - y;
      case '*': return x * y; case '/': return y !== 0 && x % y === 0 ? x / y : null;
      default: return null;
    }
  };
  if (s1 === null || s2 === null) return null;
  const intermediate = calc(s1, op1, s2);
  if (intermediate === null) return null;
  if (s3 !== null) return calc(intermediate, op2, s3);
  return intermediate;
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

  // Strict left-to-right: (a op1 b) op2 c
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

  // 2-dice pairs
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
  if (s.pendingFractionTarget !== null && !s.hasPlayedCards) {
    s = drawFromPile(s, s.fractionPenalty, s.currentPlayerIndex);
    s.message = `${s.players[s.currentPlayerIndex].name} לא הגן/ה! שלף/ה ${s.fractionPenalty} קלפי עונשין.`;
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
      return {
        ...st, players: st.players.map(p => ({ ...p, calledLolos: false })),
        currentPlayerIndex: next, phase: 'turn-transition', dice: null,
        selectedCards: [], equationResult: null, validTargets: [],
        message: '', activeOperation: null, hasPlayedCards: false, hasDrawnCard: false,
        lastCardValue: null, pendingFractionTarget: null, fractionPenalty: 0,
      };
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
        const cp = st.players[st.currentPlayerIndex];
        const hasMatch = cp.hand.some(c => c.type === 'number' && c.value === st.pendingFractionTarget);
        if (hasMatch) {
          return { ...st, phase: 'pre-roll', message: `התקפת שבר! הנח/י קלף עם הערך ${st.pendingFractionTarget} או שלוף/י ${st.fractionPenalty} קלפים.` };
        }
        let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
        return { ...s, phase: 'pre-roll', pendingFractionTarget: null, fractionPenalty: 0, message: `אין קלף ${st.pendingFractionTarget}! שלפת ${st.fractionPenalty} קלפי עונשין.` };
      }
      return { ...st, phase: 'pre-roll', message: '' };
    }

    case 'ROLL_DICE': {
      if (st.phase !== 'pre-roll') return st;
      const dice = rollDiceUtil();
      let ns: GameState = { ...st, dice };
      if (isTriple(dice)) {
        let s = { ...ns, players: ns.players.map(p => ({ ...p, hand: [...p.hand] })) };
        for (let i = 0; i < s.players.length; i++)
          if (i !== st.currentPlayerIndex) s = drawFromPile(s, dice.die1, i);
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

    case 'SELECT_CARD': {
      if (st.phase !== 'solved' && st.phase !== 'building') return st;
      if (st.hasPlayedCards) return st;
      const isSel = st.selectedCards.some(c => c.id === action.card.id);
      return { ...st, selectedCards: isSel ? st.selectedCards.filter(c => c.id !== action.card.id) : [...st.selectedCards, action.card], message: '' };
    }

    case 'DISCARD_AND_END': {
      if (st.phase !== 'solved') return st;
      if (st.hasPlayedCards) return st;
      if (st.selectedCards.length === 0) return st;

      // Fraction defense
      if (st.pendingFractionTarget !== null) {
        const nums = st.selectedCards.filter(c => c.type === 'number');
        if (nums.length !== 1 || nums[0].value !== st.pendingFractionTarget) return st;
        const defId = nums[0].id;
        const cp = st.players[st.currentPlayerIndex];
        const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== defId) } : p);
        let ns: GameState = {
          ...st, players: np, discardPile: [...st.discardPile, nums[0]],
          selectedCards: [], hasPlayedCards: true, pendingFractionTarget: null, fractionPenalty: 0,
          lastCardValue: nums[0].value ?? null, message: '',
        };
        ns = checkWin(ns);
        return ns.phase === 'game-over' ? ns : { ...ns, phase: 'solved' };
      }

      // Normal: selected number cards must sum to equationResult
      const nums = st.selectedCards.filter(c => c.type === 'number');
      if (nums.length !== st.selectedCards.length) return st;
      const sum = nums.reduce((s, c) => s + (c.value ?? 0), 0);
      if (st.equationResult !== null && sum !== st.equationResult) return st;
      if (!st.validTargets.some(t => t.result === sum)) return st;
      const ids = new Set(st.selectedCards.map(c => c.id));
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => !ids.has(c.id)) } : p);
      const lastVal = nums[nums.length - 1].value ?? null;
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, ...st.selectedCards], selectedCards: [], identicalPlayCount: 0, hasPlayedCards: true, lastCardValue: lastVal, message: '' };
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
      const identVal = action.card.type === 'number' ? action.card.value ?? null : null;
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], hasPlayedCards: true, lastCardValue: identVal, message: '' };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns);
    }

    case 'PLAY_OPERATION': {
      if (st.phase !== 'pre-roll' && st.phase !== 'solved' && st.phase !== 'building') return st;
      if (st.hasPlayedCards) return st;
      if (action.card.type !== 'operation') return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.card.operation!, selectedCards: [], hasPlayedCards: true, message: '' };
      ns = checkWin(ns);
      return ns;
    }

    case 'PLAY_FRACTION': {
      if (st.phase !== 'solved' && st.phase !== 'building') return st;
      if (st.hasPlayedCards) return st;
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateFractionPlay(action.card, td)) return st;
      const cp = st.players[st.currentPlayerIndex];
      const denom = fractionDenominator(action.card.fraction!);
      const requiredResult = td.value! / denom;
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = {
        ...st, players: np, discardPile: [...st.discardPile, action.card],
        selectedCards: [], hasPlayedCards: true,
        pendingFractionTarget: requiredResult, fractionPenalty: denom, message: '',
      };
      ns = checkWin(ns);
      return ns;
    }

    case 'OPEN_JOKER_MODAL':
      return { ...st, jokerModalOpen: true, selectedCards: [action.card] };
    case 'CLOSE_JOKER_MODAL':
      return { ...st, jokerModalOpen: false, selectedCards: [] };

    case 'PLAY_JOKER': {
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.chosenOperation, selectedCards: [], jokerModalOpen: false, hasPlayedCards: true, message: '' };
      ns = checkWin(ns);
      return ns;
    }

    case 'DRAW_CARD': {
      if (st.hasPlayedCards) return st;
      if (st.hasDrawnCard) return st;
      let s = reshuffleDiscard(st);
      if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: '' };
      const drawnCard = s.drawPile[0];
      s = drawFromPile(s, 1, s.currentPlayerIndex);
      s = { ...s, hasDrawnCard: true };
      const topDiscard = s.discardPile[s.discardPile.length - 1];
      if (drawnCard.type === 'number' && topDiscard && topDiscard.type === 'number' && drawnCard.value === topDiscard.value) {
        return endTurnLogic(s);
      }
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

const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> }>({
  state: initialState, dispatch: () => undefined,
});

function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

function useGame() { return useContext(GameContext); }

// ═══════════════════════════════════════════════════════════════
//  BUTTON
// ═══════════════════════════════════════════════════════════════

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'gold';
type BtnSize = 'sm' | 'md' | 'lg';
const btnBg: Record<BtnVariant, string> = { primary: '#2563EB', secondary: '#4B5563', danger: '#DC2626', success: '#16A34A', gold: '#EAB308' };
const btnTx: Record<BtnVariant, string> = { primary: '#FFF', secondary: '#FFF', danger: '#FFF', success: '#FFF', gold: '#000' };
const btnPd: Record<BtnSize, [number, number]> = { sm: [6, 12], md: [10, 16], lg: [14, 24] };
const btnFs: Record<BtnSize, number> = { sm: 13, md: 15, lg: 17 };

function Btn({ variant = 'primary', size = 'md', children, onPress, disabled, style }: {
  variant?: BtnVariant; size?: BtnSize; children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any;
}) {
  const [pv, ph] = btnPd[size];
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}
      style={[bS.base, { backgroundColor: btnBg[variant], paddingVertical: pv, paddingHorizontal: ph, opacity: disabled ? 0.5 : 1 }, style]}>
      {typeof children === 'string'
        ? <Text style={[bS.text, { color: btnTx[variant], fontSize: btnFs[size] }]}>{children}</Text>
        : children}
    </TouchableOpacity>
  );
}
const bS = StyleSheet.create({
  base: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════

function AppModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mS.overlay}>
        <View style={mS.box}>
          <View style={mS.header}>
            <Text style={mS.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={mS.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ flexGrow: 0 }}>{children}</ScrollView>
        </View>
      </View>
    </RNModal>
  );
}
const mS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: { backgroundColor: '#1F2937', borderRadius: 16, padding: 20, width: '100%', maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  close: { color: '#9CA3AF', fontSize: 22 },
});

// ═══════════════════════════════════════════════════════════════
//  BASE CARD
// ═══════════════════════════════════════════════════════════════

function BaseCard({ children, borderColor = '#9CA3AF', bgColor = '#FFF', selected = false, onPress, faceDown = false, small = false }: {
  children: React.ReactNode; borderColor?: string; bgColor?: string; selected?: boolean; onPress?: () => void; faceDown?: boolean; small?: boolean;
}) {
  const w = small ? 52 : 72;
  const h = small ? 76 : 104;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);

  if (faceDown) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[cardS.card, { width: w, height: h, backgroundColor: '#312E81', borderColor: '#818CF8' }]}>
        <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(129,140,248,0.4)' }} />
      </View>
    </TouchableOpacity>
  );
  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[cardS.card, { width: w, height: h, backgroundColor: bgColor, borderColor: selected ? '#FACC15' : borderColor, borderWidth: selected ? 2.5 : 2, transform: [{ translateY: selected ? -8 : 0 }] }, selected && cardS.sel]}>
          {children}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cardS = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  sel: { shadowColor: '#FACC15', shadowOpacity: 0.4, elevation: 8 },
});

// ═══════════════════════════════════════════════════════════════
//  DIE
// ═══════════════════════════════════════════════════════════════

const dotPos: Record<number, [number, number][]> = {
  1: [[50,50]], 2: [[25,25],[75,75]], 3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]], 5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
};
const DS = 56;

function Die({ value, rolling }: { value: number | null; rolling?: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (rolling) { spin.setValue(0); Animated.timing(spin, { toValue: 1, duration: 600, useNativeDriver: true }).start(); } }, [rolling]);
  const rz = spin.interpolate({ inputRange: [0,1], outputRange: ['0deg','720deg'] });
  const dots = value && !rolling ? dotPos[value] || [] : [];
  return (
    <Animated.View style={[dieS.die, { transform: [{ rotateZ: rz as any }] }]}>
      {dots.length > 0
        ? dots.map(([x,y], i) => <View key={i} style={[dieS.dot, { left: (x/100)*DS-6, top: (y/100)*DS-6 }]} />)
        : <Text style={dieS.ph}>?</Text>}
    </Animated.View>
  );
}
const dieS = StyleSheet.create({
  die: { width: DS, height: DS, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#1F2937' },
  ph: { position: 'absolute', width: '100%', textAlign: 'center', top: 14, fontSize: 22, fontWeight: '700', color: '#D1D5DB' },
});

// ═══════════════════════════════════════════════════════════════
//  CARD TYPE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function getNumCol(v: number) { if (v <= 9) return { b: '#3B82F6', t: '#2563EB' }; if (v <= 19) return { b: '#22C55E', t: '#16A34A' }; return { b: '#EF4444', t: '#DC2626' }; }

function NumberCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const v = card.value ?? 0; const cl = getNumCol(v);
  return <BaseCard borderColor={cl.b} bgColor="#FFF" selected={selected} onPress={onPress} small={small}>
    <View style={{ alignItems: 'center' }}><Text style={{ color: cl.t, fontSize: small ? 18 : 24, fontWeight: '800' }}>{v}</Text>{!small && <Text style={{ color: '#9CA3AF', fontSize: 7, marginTop: 2 }}>מספר</Text>}</View>
  </BaseCard>;
}

const fDisp: Record<string, { n: string; d: string; s: string }> = { '1/2': { n: '1', d: '2', s: '½' }, '1/3': { n: '1', d: '3', s: '⅓' }, '1/4': { n: '1', d: '4', s: '¼' }, '1/5': { n: '1', d: '5', s: '⅕' } };

function FractionCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const f = fDisp[card.fraction ?? '1/2'];
  return <BaseCard borderColor="#8B5CF6" bgColor="#F5F3FF" selected={selected} onPress={onPress} small={small}>
    <View style={{ alignItems: 'center' }}>{small
      ? <Text style={{ color: '#7C3AED', fontSize: 20, fontWeight: '800' }}>{f.s}</Text>
      : <><Text style={{ color: '#7C3AED', fontSize: 18, fontWeight: '800', lineHeight: 22 }}>{f.n}</Text><View style={{ width: 22, height: 2, backgroundColor: '#A78BFA', marginVertical: 2 }} /><Text style={{ color: '#7C3AED', fontSize: 18, fontWeight: '800', lineHeight: 22 }}>{f.d}</Text><Text style={{ color: '#A78BFA', fontSize: 7, marginTop: 2 }}>שבר</Text></>
    }</View>
  </BaseCard>;
}

function OperationCardComp({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return <BaseCard borderColor="#F97316" bgColor="#FFF7ED" selected={selected} onPress={onPress} small={small}>
    <View style={{ alignItems: 'center' }}><Text style={{ color: '#EA580C', fontSize: small ? 20 : 30, fontWeight: '800' }}>{card.operation}</Text>{!small && <Text style={{ color: '#FB923C', fontSize: 7, marginTop: 2 }}>פעולה</Text>}</View>
  </BaseCard>;
}

function JokerCard({ card: _c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return <BaseCard borderColor="#EAB308" bgColor="#FEFCE8" selected={selected} onPress={onPress} small={small}>
    <View style={{ alignItems: 'center' }}><Text style={{ color: '#CA8A04', fontSize: small ? 14 : 20 }}>★</Text><Text style={{ color: '#CA8A04', fontSize: small ? 10 : 13, fontWeight: '800' }}>ג'וקר</Text></View>
  </BaseCard>;
}

function GameCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  switch (card.type) {
    case 'number': return <NumberCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'fraction': return <FractionCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'operation': return <OperationCardComp card={card} selected={selected} onPress={onPress} small={small} />;
    case 'joker': return <JokerCard card={card} selected={selected} onPress={onPress} small={small} />;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DRAW PILE / DISCARD PILE
// ═══════════════════════════════════════════════════════════════

function DrawPile() {
  const { state, dispatch } = useGame();
  const canDraw = (state.phase === 'pre-roll' || state.phase === 'building') && !state.hasPlayedCards;
  return (
    <View style={{ alignItems: 'center' }}>
      <BaseCard faceDown onPress={canDraw ? () => dispatch({ type: 'DRAW_CARD' }) : undefined}><></></BaseCard>
    </View>
  );
}

function DiscardPile() {
  const { state } = useGame();
  const top = state.discardPile[state.discardPile.length - 1];
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      {top ? <GameCard card={top} /> : <View style={dpS.empty}><Text style={{ color: '#6B7280', fontSize: 11 }}>ריק</Text></View>}
      <Text style={{ color: '#9CA3AF', fontSize: 11 }}>ערימה</Text>
    </View>
  );
}
const dpS = StyleSheet.create({ empty: { width: 72, height: 104, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#4B5563', alignItems: 'center', justifyContent: 'center' } });

// ═══════════════════════════════════════════════════════════════
//  DICE AREA
// ═══════════════════════════════════════════════════════════════

function DiceArea() {
  const { state, dispatch } = useGame();
  const [rolling, setRolling] = useState(false);
  const handleRoll = () => {
    if (state.phase !== 'pre-roll') return;
    setRolling(true);
    setTimeout(() => { dispatch({ type: 'ROLL_DICE' }); setRolling(false); }, 600);
  };
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Die value={state.dice?.die1 ?? null} rolling={rolling} />
        <Die value={state.dice?.die2 ?? null} rolling={rolling} />
        <Die value={state.dice?.die3 ?? null} rolling={rolling} />
      </View>
      {state.phase === 'pre-roll' && !state.hasPlayedCards && (
        <Btn onPress={handleRoll} variant="primary" disabled={rolling}>{rolling ? 'מגלגל...' : 'הטל קוביות'}</Btn>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CELEBRATION FLASH (Joker rainbow)
// ═══════════════════════════════════════════════════════════════

const RAINBOW = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'];

function CelebrationFlash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const colorIdx = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(colorIdx, { toValue: RAINBOW.length - 1, duration: 800, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => onDone());
  }, []);
  const bg = colorIdx.interpolate({ inputRange: RAINBOW.map((_, i) => i), outputRange: RAINBOW });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg as any, opacity: opacity as any }]} pointerEvents="none">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 60, fontWeight: '900', color: '#FFF' }}>★ ג'וקר! ★</Text>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  EQUATION BUILDER
// ═══════════════════════════════════════════════════════════════

const SLOT_SZ = 46;
const OP_SZ = 32;

function EquationBuilder() {
  const { state, dispatch } = useGame();

  const [slots, setSlots] = useState<(number | null)[]>([null, null, null]);
  const [op1, setOp1] = useState('+');
  const [op2, setOp2] = useState('+');
  const [selectedDie, setSelectedDie] = useState<number | null>(null);

  const diceKey = state.dice ? `${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  useEffect(() => {
    setSlots([null, null, null]); setOp1('+'); setOp2('+'); setSelectedDie(null);
  }, [diceKey]);

  if (state.phase !== 'building') return null;
  if (!state.dice) return null;
  if (state.activeOperation || state.pendingFractionTarget !== null) return null;

  const diceValues = [state.dice.die1, state.dice.die2, state.dice.die3];
  const placedIndices = new Set(slots.filter((s): s is number => s !== null));
  const pool = [0, 1, 2].filter(i => !placedIndices.has(i));

  const handlePoolTap = (dieIndex: number) => {
    if (selectedDie === dieIndex) { setSelectedDie(null); return; }
    const firstEmpty = slots.findIndex(s => s === null);
    if (firstEmpty !== -1) {
      const next = [...slots]; next[firstEmpty] = dieIndex;
      setSlots(next); setSelectedDie(null);
    } else { setSelectedDie(dieIndex); }
  };

  const handleSlotTap = (slotIndex: number) => {
    const current = slots[slotIndex];
    if (current !== null) {
      const next = [...slots]; next[slotIndex] = null;
      setSlots(next); return;
    }
    if (selectedDie !== null) {
      const next = [...slots]; next[slotIndex] = selectedDie;
      setSlots(next); setSelectedDie(null);
    }
  };

  const cycleOp = (cur: string) => EQ_OPS_STR[(EQ_OPS_STR.indexOf(cur) + 1) % EQ_OPS_STR.length];
  const slotVal = (i: number): number | null => slots[i] !== null ? diceValues[slots[i]!] : null;

  // getCurrentResult(): strict L-to-R, 3rd slot optional
  const currentResult = getCurrentResult(slotVal(0), op1, slotVal(1), op2, slotVal(2));

  // targetCard = sum of selected hand number cards
  const selectedNums = state.selectedCards.filter(c => c.type === 'number');
  const targetCard = selectedNums.reduce((s, c) => s + (c.value ?? 0), 0);

  // Single boolean
  const isEquationValid = currentResult !== null
    && selectedNums.length > 0
    && currentResult === targetCard
    && state.validTargets.some(t => t.result === currentResult);

  const handleConfirm = () => {
    if (!isEquationValid) return;
    dispatch({ type: 'CONFIRM_EQUATION', result: currentResult! });
    dispatch({ type: 'DISCARD_AND_END' });
  };

  return (
    <View style={eqS.wrapper}>
      <Text style={eqS.title}>בנה/י משוואה מהקוביות</Text>
      <View style={eqS.poolRow}>
        {pool.map(i => (
          <TouchableOpacity key={`pool-${i}`} style={[eqS.poolDie, selectedDie === i && eqS.poolDieSelected]}
            onPress={() => handlePoolTap(i)} activeOpacity={0.7}>
            <Text style={eqS.poolDieText}>{diceValues[i]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={eqS.eqRow}>
        <TouchableOpacity style={[eqS.slot, slotVal(0) === null ? eqS.slotEmpty : eqS.slotFilled]}
          onPress={() => handleSlotTap(0)} activeOpacity={0.7}>
          {slotVal(0) !== null && <Text style={eqS.slotValue}>{slotVal(0)}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={eqS.opCircle}
          onPress={() => setOp1(cycleOp(op1))} activeOpacity={0.7}>
          <Text style={eqS.opCircleText}>{op1}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[eqS.slot, slotVal(1) === null ? eqS.slotEmpty : eqS.slotFilled]}
          onPress={() => handleSlotTap(1)} activeOpacity={0.7}>
          {slotVal(1) !== null && <Text style={eqS.slotValue}>{slotVal(1)}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={eqS.opCircle}
          onPress={() => setOp2(cycleOp(op2))} activeOpacity={0.7}>
          <Text style={eqS.opCircleText}>{op2}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[eqS.slot, slotVal(2) === null ? eqS.slotEmpty : eqS.slotFilled]}
          onPress={() => handleSlotTap(2)} activeOpacity={0.7}>
          {slotVal(2) !== null && <Text style={eqS.slotValue}>{slotVal(2)}</Text>}
        </TouchableOpacity>

        <Text style={eqS.equals}>=</Text>
        <View style={[eqS.resultBox, currentResult !== null && eqS.resultBoxFilled]}>
          <Text style={eqS.resultText}>{currentResult !== null ? currentResult : '?'}</Text>
        </View>

        <TouchableOpacity
          style={[eqS.confirmBtn, isEquationValid ? eqS.confirmBtnOn : eqS.confirmBtnOff]}
          onPress={handleConfirm}
          disabled={!isEquationValid}
          activeOpacity={0.7}>
          <Text style={eqS.confirmText}>אשר</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const eqS = StyleSheet.create({
  wrapper: { backgroundColor: 'rgba(31,41,55,0.6)', borderRadius: 12, padding: 12, alignItems: 'center', gap: 10 },
  title: { color: '#93C5FD', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  poolRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', minHeight: 42 },
  poolDie: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#93C5FD', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3 },
  poolDieSelected: { borderColor: '#FACC15', borderWidth: 2.5, shadowColor: '#FACC15', shadowOpacity: 0.4, elevation: 6 },
  poolDieText: { fontSize: 18, fontWeight: '800', color: '#1E40AF' },
  eqRow: { flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 5 },
  slot: { width: SLOT_SZ, height: SLOT_SZ, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  slotEmpty: { backgroundColor: 'rgba(55,65,81,0.4)', borderWidth: 2, borderStyle: 'dashed', borderColor: '#6B7280' },
  slotFilled: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#3B82F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  slotValue: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  opCircle: { width: OP_SZ, height: OP_SZ, borderRadius: OP_SZ / 2, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  opCircleText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  equals: { fontSize: 22, fontWeight: '800', color: '#9CA3AF', marginHorizontal: 2 },
  resultBox: { width: SLOT_SZ, height: SLOT_SZ, borderRadius: 10, backgroundColor: '#1F2937', borderWidth: 2, borderColor: '#4B5563', alignItems: 'center', justifyContent: 'center' },
  resultBoxFilled: { borderColor: '#22C55E' },
  resultText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  confirmBtn: { paddingHorizontal: 12, height: SLOT_SZ, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confirmBtnOn: { backgroundColor: '#16A34A' },
  confirmBtnOff: { backgroundColor: '#4B5563', opacity: 0.5 },
  confirmText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════
//  ACTION BAR
// ═══════════════════════════════════════════════════════════════

function ActionBar() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  if (!cp) return null;

  const isPreRoll = state.phase === 'pre-roll';
  const isBuilding = state.phase === 'building';
  const isSolved = state.phase === 'solved';
  const hp = state.hasPlayedCards;

  const hasOpChallenge = isPreRoll && !!state.activeOperation && !hp;
  const hasFracChallenge = isPreRoll && state.pendingFractionTarget !== null && !hp;
  const hasChallenge = hasOpChallenge || hasFracChallenge;

  const selNums = state.selectedCards.filter(c => c.type === 'number');
  const selectedSum = selNums.reduce((s, c) => s + (c.value ?? 0), 0);
  const canDiscard = isSolved && !hp && selNums.length > 0 && selNums.length === state.selectedCards.length;

  const canDefendFrac = isSolved && state.pendingFractionTarget !== null && !hp
    && selNums.length === 1 && selNums[0].value === state.pendingFractionTarget;

  const canCallLolos = (isPreRoll || isBuilding || isSolved) && cp.hand.length <= 2 && !cp.calledLolos && !hasChallenge;

  return (
    <View style={aS.container}>
      {hasOpChallenge && (
        <View style={aS.opSec}>
          <Text style={aS.opT}>אתגר פעולה: {state.activeOperation}</Text>
          <Btn variant="danger" size="sm" onPress={() => dispatch({ type: 'END_TURN' })}>קבל/י עונש</Btn>
        </View>
      )}

      {hasFracChallenge && (
        <View style={aS.opSec}>
          <Text style={aS.opT}>התקפת שבר! נדרש: {state.pendingFractionTarget}</Text>
          <Btn variant="danger" size="sm" onPress={() => dispatch({ type: 'END_TURN' })}>
            {`קבל עונש (${state.fractionPenalty})`}
          </Btn>
        </View>
      )}

      {isBuilding && !hp && (
        <View style={aS.row}>
          <Btn variant="secondary" size="sm" onPress={() => dispatch({ type: 'DRAW_CARD' })}>שלוף קלף (ויתור)</Btn>
        </View>
      )}

      {isSolved && !hp && state.pendingFractionTarget !== null && (
        <View style={aS.opSec}>
          <Text style={aS.opT}>התקפת שבר! נדרש: {state.pendingFractionTarget}</Text>
          {canDefendFrac && (
            <Btn variant="success" size="sm" onPress={() => dispatch({ type: 'DISCARD_AND_END' })}>
              {`הגן (${state.pendingFractionTarget})`}
            </Btn>
          )}
        </View>
      )}

      {canDiscard && !state.pendingFractionTarget && (
        <View style={aS.row}>
          <Btn variant="success" onPress={() => dispatch({ type: 'DISCARD_AND_END' })}>
            {`אשר והנח (${selectedSum})`}
          </Btn>
        </View>
      )}

      {(isPreRoll || isSolved) && hp && (
        <View style={aS.row}>
          <Btn variant="secondary" onPress={() => dispatch({ type: 'END_TURN' })}>סיים תור</Btn>
        </View>
      )}

      {canCallLolos && (
        <View style={aS.row}>
          <Btn variant="gold" size="lg" onPress={() => dispatch({ type: 'CALL_LOLOS' })}>לולוס!</Btn>
        </View>
      )}

      {!!state.message && <View style={aS.msg}><Text style={aS.msgT}>{state.message}</Text></View>}

      <AppModal visible={state.jokerModalOpen} onClose={() => dispatch({ type: 'CLOSE_JOKER_MODAL' })} title="בחר/י פעולה לג'וקר">
        <View style={aS.jGrid}>
          {(['+', '-', 'x', '÷'] as Operation[]).map(op => (
            <Btn key={op} variant="primary" size="lg" onPress={() => { const j = state.selectedCards[0]; if (j) dispatch({ type: 'PLAY_JOKER', card: j, chosenOperation: op }); }} style={{ width: '45%', minWidth: 100 }}>{op}</Btn>
          ))}
        </View>
      </AppModal>
    </View>
  );
}
const aS = StyleSheet.create({
  container: { width: '100%', gap: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  opSec: { backgroundColor: 'rgba(154,52,18,0.2)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderRadius: 10, padding: 12 },
  opT: { color: '#FDBA74', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  msg: { backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 10, padding: 10, alignItems: 'center' },
  msgT: { color: '#FDE68A', fontSize: 13, textAlign: 'center' },
  jGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
});

// ═══════════════════════════════════════════════════════════════
//  PLAYER HAND — always full opacity, always tappable
// ═══════════════════════════════════════════════════════════════

function PlayerHand() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  if (!cp) return null;

  const isPreRoll = state.phase === 'pre-roll';
  const isBuilding = state.phase === 'building';
  const isSolved = state.phase === 'solved';
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const hasOpChallenge = isPreRoll && !!state.activeOperation && !state.hasPlayedCards;
  const hasFracChallenge = isPreRoll && state.pendingFractionTarget !== null && !state.hasPlayedCards;

  const sorted = [...cp.hand].sort((a, b) => {
    const o = { number: 0, fraction: 1, operation: 2, joker: 3 } as const;
    if (o[a.type] !== o[b.type]) return o[a.type] - o[b.type];
    if (a.type === 'number' && b.type === 'number') return (a.value ?? 0) - (b.value ?? 0);
    return 0;
  });

  const handleCardTap = (card: Card) => {
    if (state.hasPlayedCards) return;

    if (isPreRoll) {
      if (hasOpChallenge) {
        if (card.type === 'operation' && card.operation === state.activeOperation) {
          dispatch({ type: 'PLAY_OPERATION', card });
        } else if (card.type === 'joker') {
          dispatch({ type: 'OPEN_JOKER_MODAL', card });
        }
        return;
      }
      if (hasFracChallenge) {
        if (card.type === 'number' && card.value === state.pendingFractionTarget) {
          dispatch({ type: 'SELECT_CARD', card });
        }
        return;
      }
      if (validateIdenticalPlay(card, topDiscard)) {
        dispatch({ type: 'PLAY_IDENTICAL', card });
      }
      return;
    }

    if (isBuilding || isSolved) {
      if (card.type === 'number') {
        dispatch({ type: 'SELECT_CARD', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      } else if (card.type === 'operation') {
        dispatch({ type: 'PLAY_OPERATION', card });
      } else if (card.type === 'joker') {
        dispatch({ type: 'OPEN_JOKER_MODAL', card });
      }
    }
  };

  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Text style={{ color: '#D1D5DB', fontSize: 13, fontWeight: '600' }}>היד של {cp.name}</Text>
        <Text style={{ color: '#6B7280', fontSize: 11 }}>({cp.hand.length} קלפים)</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4, paddingBottom: 4 }}>
        {sorted.map(card => {
          const sel = state.selectedCards.some(c => c.id === card.id);
          return <GameCard key={card.id} card={card} selected={sel} small onPress={() => handleCardTap(card)} />;
        })}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  START SCREEN
// ═══════════════════════════════════════════════════════════════

function StartScreen() {
  const { dispatch } = useGame();
  const [pc, setPc] = useState(2);
  const [names, setNames] = useState<string[]>(Array(10).fill(''));
  const [diff, setDiff] = useState<'easy' | 'full'>('full');
  const [rules, setRules] = useState(false);
  const mx = diff === 'easy' ? 8 : 10;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#111827' }} contentContainerStyle={{ padding: 24, paddingTop: 60, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 48, fontWeight: '900', color: '#F59E0B', letterSpacing: 4 }}>לולוס</Text>
      <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4, marginBottom: 28 }}>משחק קלפים חשבוני חינוכי</Text>

      <Text style={ssS.label}>מספר שחקנים</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' }}>
        {Array.from({ length: mx - 1 }, (_, i) => i + 2).map(n => (
          <TouchableOpacity key={n} onPress={() => setPc(n)} style={[ssS.cBtn, pc === n && ssS.cAct]}>
            <Text style={[ssS.cTxt, pc === n && { color: '#FFF' }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={ssS.label}>שמות השחקנים</Text>
      {Array.from({ length: pc }, (_, i) => (
        <TextInput key={i} placeholder={`שחקן ${i + 1}`} placeholderTextColor="#6B7280" value={names[i]}
          onChangeText={t => { const n = [...names]; n[i] = t; setNames(n); }}
          style={ssS.inp} textAlign="right" />
      ))}

      <Text style={ssS.label}>רמת קושי</Text>
      <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
        <TouchableOpacity style={[ssS.dBtn, diff === 'easy' && { backgroundColor: '#16A34A' }]} onPress={() => { setDiff('easy'); setPc(c => Math.min(c, 8)); }}>
          <Text style={[ssS.dTxt, diff === 'easy' && { color: '#FFF' }]}>קל (0-12)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ssS.dBtn, diff === 'full' && { backgroundColor: '#DC2626' }]} onPress={() => setDiff('full')}>
          <Text style={[ssS.dTxt, diff === 'full' && { color: '#FFF' }]}>מלא (0-25)</Text>
        </TouchableOpacity>
      </View>

      <Btn variant="success" size="lg" onPress={() => {
        const players = Array.from({ length: pc }, (_, i) => ({ name: names[i].trim() || `שחקן ${i + 1}` }));
        dispatch({ type: 'START_GAME', players, difficulty: diff });
      }} style={{ width: '100%', marginTop: 12 }}>התחל משחק</Btn>

      <Btn variant="secondary" size="sm" onPress={() => setRules(!rules)} style={{ width: '100%', marginTop: 8 }}>
        {rules ? 'הסתר חוקים' : 'איך משחקים?'}
      </Btn>
      {rules && (
        <View style={ssS.rBox}>
          <Text style={ssS.rTitle}>איך משחקים לולוס</Text>
          {[
            'כל שחקן מקבל 10 קלפים. הראשון שמרוקן את היד — מנצח!',
            'הטל 3 קוביות וצור מספר יעד באמצעות חשבון (הקובייה השלישית אופציונלית).',
            'בחר/י קלפי מספר מהיד שסכומם שווה לתוצאת המשוואה.',
            'לפני הטלת קוביות: אם יש קלף תואם לערימה — לחץ עליו לסיום תור.',
            'כשנותר 1-2 קלפים — לחץ "לולוס!" לפני שתסיים, אחרת תשלוף עונשין.',
          ].map((r, i) => <Text key={i} style={ssS.rItem}>{i + 1}. {r}</Text>)}
        </View>
      )}
    </ScrollView>
  );
}
const ssS = StyleSheet.create({
  label: { color: '#D1D5DB', fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 8, marginTop: 16 },
  cBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  cAct: { backgroundColor: '#2563EB' },
  cTxt: { color: '#D1D5DB', fontWeight: '700', fontSize: 14 },
  inp: { width: '100%', backgroundColor: '#374151', borderWidth: 1, borderColor: '#4B5563', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 14, marginBottom: 6 },
  dBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  dTxt: { color: '#D1D5DB', fontWeight: '600', fontSize: 14 },
  rBox: { marginTop: 16, backgroundColor: 'rgba(55,65,81,0.5)', borderRadius: 10, padding: 16, width: '100%' },
  rTitle: { color: '#FFF', fontWeight: '700', fontSize: 15, marginBottom: 10, textAlign: 'right' },
  rItem: { color: '#D1D5DB', fontSize: 12, marginBottom: 6, lineHeight: 20, textAlign: 'right' },
});

// ═══════════════════════════════════════════════════════════════
//  TURN TRANSITION
// ═══════════════════════════════════════════════════════════════

function TurnTransition() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  return (
    <View style={ttS.container}>
      <TouchableOpacity style={ttS.exit} onPress={() => dispatch({ type: 'RESET_GAME' })}>
        <Text style={ttS.exitT}>יציאה</Text>
      </TouchableOpacity>
      <Text style={{ color: '#9CA3AF', fontSize: 14 }}>העבר/י את המכשיר ל</Text>
      <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 8 }}>{cp?.name}</Text>
      <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8 }}>{cp?.hand.length} קלפים ביד</Text>
      {!!state.message && <View style={ttS.msgBox}><Text style={ttS.msgT}>{state.message}</Text></View>}
      <Btn variant="primary" size="lg" onPress={() => dispatch({ type: 'BEGIN_TURN' })} style={{ width: '100%', marginTop: 24 }}>אני מוכן/ה</Btn>
    </View>
  );
}
const ttS = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', padding: 32 },
  exit: { position: 'absolute', top: 54, right: 20, backgroundColor: '#DC2626', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  exitT: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  msgBox: { backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 10, padding: 12, marginTop: 16, width: '100%' },
  msgT: { color: '#FDE68A', fontSize: 13, textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════
//  GAME SCREEN
// ═══════════════════════════════════════════════════════════════

function PlayerInfo() {
  const { state } = useGame();
  return (
    <View style={piS.row}>
      {state.players.map((p, i) => (
        <View key={p.id} style={[piS.pill, i === state.currentPlayerIndex && piS.pillActive]}>
          <Text style={[piS.name, i === state.currentPlayerIndex && piS.nameActive]} numberOfLines={1}>{p.name}</Text>
          <Text style={piS.count}>{p.hand.length}</Text>
        </View>
      ))}
    </View>
  );
}
const piS = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(55,65,81,0.5)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pillActive: { backgroundColor: 'rgba(59,130,246,0.25)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
  name: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', maxWidth: 80 },
  nameActive: { color: '#FFF' },
  count: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
});

function GameScreen() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  const [showCelebration, setShowCelebration] = useState(false);
  const prevJokerOpen = useRef(state.jokerModalOpen);

  useEffect(() => {
    if (prevJokerOpen.current && !state.jokerModalOpen && state.hasPlayedCards) {
      setShowCelebration(true);
    }
    prevJokerOpen.current = state.jokerModalOpen;
  }, [state.jokerModalOpen, state.hasPlayedCards]);

  return (
    <View style={gsS.container}>
      <View style={gsS.header}>
        <TouchableOpacity style={gsS.exit} onPress={() => dispatch({ type: 'RESET_GAME' })}>
          <Text style={gsS.exitT}>יציאה</Text>
        </TouchableOpacity>
        <Text style={gsS.logo}>לולוס</Text>
        <Text style={gsS.turn}>
          תורו/ה של <Text style={{ color: '#FFF', fontWeight: '700' }}>{cp?.name}</Text>
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <PlayerInfo />

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={gsS.deckCounter}>קלפים שנותרו: {state.drawPile.length}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32 }}>
            <DrawPile />
            <DiscardPile />
          </View>
        </View>

        <DiceArea />
        <EquationBuilder />
        <ActionBar />
      </ScrollView>

      <View style={gsS.hand}>
        <PlayerHand />
      </View>

      {showCelebration && <CelebrationFlash onDone={() => setShowCelebration(false)} />}
    </View>
  );
}
const gsS = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  exit: { backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  exitT: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  logo: { color: '#F59E0B', fontSize: 20, fontWeight: '900', letterSpacing: 2, flex: 1, textAlign: 'center' },
  turn: { color: '#D1D5DB', fontSize: 13 },
  hand: { backgroundColor: 'rgba(31,41,55,0.3)', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 24 },
  deckCounter: { color: '#9CA3AF', fontSize: 12, fontWeight: '500', textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════
//  GAME OVER + CONFETTI
// ═══════════════════════════════════════════════════════════════

const CONFETTI_COLORS = ['#EAB308', '#3B82F6', '#EF4444', '#22C55E', '#8B5CF6', '#F97316'];

function Confetti() {
  const an = useRef(Array.from({ length: 30 }, () => ({
    x: new Animated.Value(Math.random() * SCREEN_W),
    y: new Animated.Value(-20),
    r: new Animated.Value(0),
    c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }))).current;
  useEffect(() => { an.forEach(a => { const d = 2000 + Math.random() * 2000, dl = Math.random() * 1500; Animated.parallel([Animated.timing(a.y, { toValue: SCREEN_H + 20, duration: d, delay: dl, useNativeDriver: true }), Animated.timing(a.r, { toValue: Math.random() * 720 - 360, duration: d, delay: dl, useNativeDriver: true })]).start(); }); }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {an.map((a, i) => <Animated.View key={i} style={{ position: 'absolute', width: 10, height: 10, borderRadius: 2, backgroundColor: a.c, transform: [{ translateX: a.x as any }, { translateY: a.y as any }, { rotateZ: a.r.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) as any }] }} />)}
    </View>
  );
}

function GameOver() {
  const { state, dispatch } = useGame();
  const sorted = [...state.players].sort((a, b) => a.hand.length - b.hand.length);
  return (
    <View style={goS.container}>
      <Confetti />
      <Text style={{ fontSize: 56, marginBottom: 8 }}>🏆</Text>
      <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '800' }}>המשחק נגמר!</Text>
      <Text style={{ color: '#FACC15', fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 24 }}>{state.winner?.name} ניצח/ה!</Text>
      <View style={goS.box}>
        <Text style={goS.h}>תוצאות סופיות</Text>
        {sorted.map((p, i) => <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <Text style={{ color: '#D1D5DB', fontSize: 14 }}>{i + 1}. {p.name}{p.hand.length === 0 ? ' ★' : ''}</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 14 }}>{p.hand.length} קלפים נותרו</Text>
        </View>)}
      </View>
      <Btn variant="success" size="lg" onPress={() => dispatch({ type: 'RESET_GAME' })} style={{ width: '100%', marginTop: 20 }}>שחק/י שוב</Btn>
    </View>
  );
}
const goS = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', padding: 32 },
  box: { backgroundColor: 'rgba(55,65,81,0.5)', borderRadius: 12, padding: 16, width: '100%' },
  h: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textAlign: 'right' },
});

// ═══════════════════════════════════════════════════════════════
//  ROUTER + APP + REGISTER
// ═══════════════════════════════════════════════════════════════

function GameRouter() {
  const { state } = useGame();
  switch (state.phase) {
    case 'setup': return <StartScreen />;
    case 'turn-transition': return <TurnTransition />;
    case 'pre-roll':
    case 'building':
    case 'solved': return <GameScreen />;
    case 'game-over': return <GameOver />;
    default: return <StartScreen />;
  }
}

function App() {
  return (
    <GameProvider>
      <StatusBar style="light" />
      <GameRouter />
    </GameProvider>
  );
}

registerRootComponent(App);
