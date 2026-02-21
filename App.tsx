// ============================================================
// Index.tsx — Lolos Card Game — Strict 4-Phase Flow + Joker
// ============================================================
// Phase 1 (pre-roll):  Hand visible, match identical cards, roll
// Phase 2 (building):  Dice rolled, equation builder, hand LOCKED
// Phase 3 (solved):    Equation correct, hand UNLOCKED, pick cards
// Phase 4 (confirm):   אשר after equation solved + cards selected
// ============================================================

import React, { useState, useEffect, useRef, createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  I18nManager, View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Modal as RNModal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

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

type GamePhase = 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'fraction-attack' | 'game-over';

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
  attackingFraction: Fraction | null;
  originalTargetValue: number | null;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  identicalPlayCount: number;
  jokerModalOpen: boolean;
  jokerCelebration: boolean;
  jokerEquationActive: boolean;
  jokerEquationOp: Operation | null;
  jokerCard: Card | null;
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
  | { type: 'FRACTION_DEFEND_SOLVE'; card: Card }
  | { type: 'FRACTION_DEFEND_BLOCK'; card: Card }
  | { type: 'FRACTION_DRAW_PENALTY' }
  | { type: 'PLAY_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'DRAW_CARD' }
  | { type: 'CALL_LOLOS' }
  | { type: 'END_TURN' }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'OPEN_JOKER_MODAL'; card: Card }
  | { type: 'CLOSE_JOKER_MODAL' }
  | { type: 'HIDE_JOKER_CELEBRATION' }
  | { type: 'REOPEN_JOKER_PICKER' }
  | { type: 'RESET_GAME' };

// ═══════════════════════════════════════════════════════════════
//  ARITHMETIC
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

function computeSlotResult(
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
  const ab = calc(s1, op1, s2);
  if (ab === null) return null;
  if (s3 !== null) return calc(ab, op2, s3);
  return ab;
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
            const eq = `(${a} ${op1} ${b}) ${op2} ${c} = ${r}`;
            if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push({ equation: eq, result: r }); }
          }
        }
        // Removed: no PEMDAS grouping — all calculations are strictly left-to-right
      }
    }
  }

  // 2-dice combinations (3rd die optional)
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
  fractionPenalty: 0, attackingFraction: null, originalTargetValue: null,
  hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
  identicalPlayCount: 0, jokerModalOpen: false,
  jokerCelebration: false, jokerEquationActive: false, jokerEquationOp: null, jokerCard: null,
  difficulty: 'full', winner: null, message: '',
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
  // Fraction penalty is now handled by FRACTION_DRAW_PENALTY — no auto-penalty here
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
    fractionPenalty: 0, attackingFraction: null, originalTargetValue: null,
    jokerEquationActive: false, jokerEquationOp: null, jokerCard: null,
    jokerCelebration: false, jokerModalOpen: false,
  };
}

// Advance turn while preserving fraction attack state for the next player
function advanceTurnWithAttack(st: GameState): GameState {
  const next = (st.currentPlayerIndex + 1) % st.players.length;
  return {
    ...st,
    players: st.players.map(p => ({ ...p, calledLolos: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    selectedCards: [], equationResult: null, validTargets: [],
    activeOperation: null, activeFraction: null,
    identicalPlayCount: 0, hasPlayedCards: false,
    hasDrawnCard: false, lastCardValue: null,
    // Preserve fraction attack state: pendingFractionTarget, fractionPenalty, attackingFraction, originalTargetValue
    jokerEquationActive: false, jokerEquationOp: null, jokerCard: null,
    jokerCelebration: false, jokerModalOpen: false,
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
        attackingFraction: null, originalTargetValue: null,
        jokerEquationActive: false, jokerEquationOp: null, jokerCard: null,
        jokerCelebration: false, jokerModalOpen: false,
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
      // Fraction attack: route to fraction-attack phase
      if (st.pendingFractionTarget !== null) {
        return {
          ...st, phase: 'fraction-attack',
          message: `⚠️ הותקפת! הנח ${st.pendingFractionTarget} או משוך ${st.fractionPenalty} קלפים`,
        };
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
      return { ...ns, validTargets: vt, phase: 'building', message: ns.message || (vt.length === 0 ? 'אין מספרים תקינים מהקוביות.' : '') };
    }

    case 'CONFIRM_EQUATION': {
      if (st.phase !== 'building') return st;
      return { ...st, phase: 'solved', equationResult: action.result, message: `נכון! בחר/י קלפים שסכומם ${action.result}` };
    }

    case 'SELECT_CARD': {
      if (st.phase !== 'solved' && st.phase !== 'building') return { ...st, message: 'פתור/י קודם את המשוואה!' };
      if (st.hasPlayedCards) return st;
      const isSel = st.selectedCards.some(c => c.id === action.card.id);
      return { ...st, selectedCards: isSel ? st.selectedCards.filter(c => c.id !== action.card.id) : [...st.selectedCards, action.card], message: '' };
    }

    case 'DISCARD_AND_END': {
      if (st.phase !== 'solved') return { ...st, message: 'פתור/י קודם את המשוואה!' };
      if (st.hasPlayedCards) return { ...st, message: 'כבר שיחקת קלפים בתור הזה!' };
      if (st.selectedCards.length === 0) return { ...st, message: 'בחר/י לפחות קלף אחד!' };

      // Fraction defense is now handled by FRACTION_DEFEND_SOLVE in fraction-attack phase

      // Normal: selected number cards must sum to equationResult
      const nums = st.selectedCards.filter(c => c.type === 'number');
      if (nums.length !== st.selectedCards.length) return { ...st, message: 'ניתן לשחק רק קלפי מספר!' };
      const sum = nums.reduce((s, c) => s + (c.value ?? 0), 0);
      if (st.equationResult !== null && sum !== st.equationResult) {
        return { ...st, message: `הסכום ${sum} לא תואם את תוצאת המשוואה ${st.equationResult}!` };
      }
      if (!st.validTargets.some(t => t.result === sum)) {
        return { ...st, message: `הסכום ${sum} לא תואם אף תוצאת קוביות.` };
      }
      const ids = new Set(st.selectedCards.map(c => c.id));
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => !ids.has(c.id)) } : p);
      const lastVal = nums[nums.length - 1].value ?? null;
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, ...st.selectedCards], selectedCards: [], identicalPlayCount: 0, hasPlayedCards: true, lastCardValue: lastVal, message: 'קלפים שוחקו!' };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns);
    }

    case 'PLAY_IDENTICAL': {
      if (st.phase !== 'pre-roll') return st;
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateIdenticalPlay(action.card, td)) return { ...st, message: 'הקלף לא תואם את הקלף העליון!' };
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      const identVal = action.card.type === 'number' ? action.card.value ?? null : null;
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], hasPlayedCards: true, lastCardValue: identVal, message: 'קלף תואם לערימה! התור נגמר.' };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns);
    }

    case 'PLAY_OPERATION': {
      if (st.phase !== 'pre-roll' && st.phase !== 'solved') return st;
      if (st.hasPlayedCards) return { ...st, message: 'כבר שיחקת קלפים בתור הזה!' };
      if (action.card.type !== 'operation') return { ...st, message: 'זה לא קלף פעולה!' };
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.card.operation!, selectedCards: [], hasPlayedCards: true, message: `שוחק קלף פעולה ${action.card.operation}!` };
      ns = checkWin(ns);
      return ns;
    }

    case 'PLAY_FRACTION': {
      // Attack mode: allowed in pre-roll AND solved phases
      if (st.phase !== 'pre-roll' && st.phase !== 'solved') return st;
      if (st.hasPlayedCards) return { ...st, message: 'כבר שיחקת קלפים בתור הזה!' };
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateFractionPlay(action.card, td)) {
        return { ...st, message: `לא ניתן להניח ${action.card.fraction} על ${td?.value}. זה לא מתחלק!` };
      }
      const cp = st.players[st.currentPlayerIndex];
      const denom = fractionDenominator(action.card.fraction!);
      const requiredResult = td.value! / denom;
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = {
        ...st, players: np, discardPile: [...st.discardPile, action.card],
        selectedCards: [], hasPlayedCards: true,
        pendingFractionTarget: requiredResult, fractionPenalty: denom,
        attackingFraction: action.card.fraction as Fraction,
        originalTargetValue: td.value!,
        message: `התקפת שבר! ${td.value} ÷ ${denom} = ${requiredResult}. היריב/ה חייב/ת להניח ${requiredResult} או לשלוף ${denom} קלפים!`,
      };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      // Turn ends immediately — advance to next player with attack pending
      return advanceTurnWithAttack(ns);
    }

    // ── Fraction Attack Defense ──
    case 'FRACTION_DEFEND_SOLVE': {
      if (st.phase !== 'fraction-attack') return st;
      if (action.card.type !== 'number' || action.card.value !== st.pendingFractionTarget) {
        return { ...st, message: `חובה להניח קלף עם הערך ${st.pendingFractionTarget}!` };
      }
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex
        ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = {
        ...st, players: np, discardPile: [...st.discardPile, action.card],
        selectedCards: [], hasPlayedCards: true,
        pendingFractionTarget: null, fractionPenalty: 0,
        attackingFraction: null, originalTargetValue: null,
        lastCardValue: action.card.value ?? null,
        message: `הגנה הצליחה! הונח קלף ${st.pendingFractionTarget}.`,
      };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      // Attack resolved — continue to normal pre-roll for this player
      return { ...ns, phase: 'pre-roll' };
    }

    case 'FRACTION_DEFEND_BLOCK': {
      if (st.phase !== 'fraction-attack') return st;
      if (action.card.type !== 'fraction' || !action.card.fraction) {
        return { ...st, message: 'חובה להניח קלף שבר כדי לחסום!' };
      }
      const blockDenom = fractionDenominator(action.card.fraction as Fraction);
      if (st.pendingFractionTarget === null || st.pendingFractionTarget % blockDenom !== 0) {
        return { ...st, message: `לא ניתן לחסום עם ${action.card.fraction}! ${st.pendingFractionTarget} לא מתחלק ב-${blockDenom}.` };
      }
      const newTarget = st.pendingFractionTarget / blockDenom;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex
        ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = {
        ...st, players: np, discardPile: [...st.discardPile, action.card],
        selectedCards: [], hasPlayedCards: true,
        pendingFractionTarget: newTarget, fractionPenalty: blockDenom,
        attackingFraction: action.card.fraction as Fraction,
        originalTargetValue: st.pendingFractionTarget,
        message: `חסימה! ${st.pendingFractionTarget} ÷ ${blockDenom} = ${newTarget}. השחקן הבא חייב להניח ${newTarget} או לשלוף ${blockDenom} קלפים!`,
      };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      // Pass attack to next player
      return advanceTurnWithAttack(ns);
    }

    case 'FRACTION_DRAW_PENALTY': {
      if (st.phase !== 'fraction-attack') return st;
      let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
      s = {
        ...s,
        pendingFractionTarget: null, fractionPenalty: 0,
        attackingFraction: null, originalTargetValue: null,
        message: `${s.players[s.currentPlayerIndex].name} קיבל/ה ${st.fractionPenalty} קלפי עונשין!`,
      };
      // Penalty taken — continue to normal pre-roll for this player
      return { ...s, phase: 'pre-roll' };
    }

    case 'OPEN_JOKER_MODAL':
      return { ...st, jokerModalOpen: true, jokerCelebration: true, selectedCards: [action.card] };
    case 'CLOSE_JOKER_MODAL':
      return { ...st, jokerModalOpen: false, jokerCelebration: false, selectedCards: [] };

    case 'PLAY_JOKER': {
      // Reopening picker to change operation on already-placed joker
      if (st.jokerEquationActive) {
        return {
          ...st, jokerEquationOp: action.chosenOperation,
          jokerModalOpen: false, jokerCelebration: false,
          message: `פעולת הג'וקר שונתה ל-${action.chosenOperation}!`,
        };
      }
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex
        ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      // Defense scenario: play joker as operation attack
      if (st.activeOperation && !st.hasPlayedCards) {
        let ns: GameState = {
          ...st, players: np,
          discardPile: [...st.discardPile, action.card],
          activeOperation: action.chosenOperation,
          selectedCards: [], jokerModalOpen: false, jokerCelebration: false,
          hasPlayedCards: true,
          message: `ג'וקר שוחק כ-${action.chosenOperation}!`,
        };
        ns = checkWin(ns);
        return ns;
      }
      // Equation builder integration: joker occupies an operation slot
      let ns: GameState = {
        ...st, players: np,
        discardPile: [...st.discardPile, action.card],
        jokerEquationActive: true,
        jokerEquationOp: action.chosenOperation,
        jokerCard: action.card,
        selectedCards: [], jokerModalOpen: false, jokerCelebration: false,
        message: `ג'וקר הופעל כ-${action.chosenOperation}!`,
      };
      ns = checkWin(ns);
      return ns;
    }

    case 'DRAW_CARD': {
      if (st.hasPlayedCards) return { ...st, message: 'כבר שיחקת קלפים! סיים/י תור.' };
      if (st.hasDrawnCard) return { ...st, message: 'כבר שלפת קלף בתור הזה!' };
      let s = reshuffleDiscard(st);
      if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: 'אין קלפים לשליפה!' };
      const drawnCard = s.drawPile[0];
      s = drawFromPile(s, 1, s.currentPlayerIndex);
      s = { ...s, hasDrawnCard: true };
      const topDiscard = s.discardPile[s.discardPile.length - 1];
      if (drawnCard.type === 'number' && topDiscard && topDiscard.type === 'number' && drawnCard.value === topDiscard.value) {
        const result = endTurnLogic(s);
        return { ...result, message: 'קלף זהה! חוק לולוס מופעל — התור נגמר.' };
      }
      return endTurnLogic(s);
    }

    case 'CALL_LOLOS': {
      const cp = st.players[st.currentPlayerIndex];
      if (cp.hand.length > 2) return { ...st, message: 'ניתן לקרוא לולוס רק עם קלף אחד או שניים ביד!' };
      return { ...st, players: st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, calledLolos: true } : p), message: `${cp.name} קרא/ה לולוס!` };
    }

    case 'END_TURN': return endTurnLogic(st);
    case 'SET_MESSAGE': return { ...st, message: action.message };
    case 'HIDE_JOKER_CELEBRATION':
      return { ...st, jokerCelebration: false };
    case 'REOPEN_JOKER_PICKER':
      return { ...st, jokerModalOpen: true };
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

function BaseCard({ children, borderColor = '#9CA3AF', bgColor = '#FFF', bgGradient, selected = false, onPress, faceDown = false, small = false }: {
  children: React.ReactNode; borderColor?: string; bgColor?: string; bgGradient?: [string, string]; selected?: boolean; onPress?: () => void; faceDown?: boolean; small?: boolean;
}) {
  const w = small ? 52 : 72;
  const h = small ? 76 : 104;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);

  // ── Face-down card (draw pile) ──
  if (faceDown) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={{
        width: w, height: h, borderRadius: 12,
        backgroundColor: '#312E81',
        borderWidth: 2, borderColor: '#818CF8',
        borderBottomWidth: small ? 4 : 5, borderBottomColor: '#1E1B4B',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
      }}>
        {/* Inner glow circle */}
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          borderWidth: 2, borderColor: 'rgba(129,140,248,0.5)',
          backgroundColor: 'rgba(129,140,248,0.1)',
        }} />
        {/* Top gloss */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: small ? 24 : 34, borderTopLeftRadius: 10, borderTopRightRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }} />
      </View>
    </TouchableOpacity>
  );

  // ── Face-up card ──
  const bg = bgGradient ? bgGradient[0] : bgColor;
  const edge = bgGradient ? bgGradient[1] : borderColor;
  const glossH = small ? 24 : 34;

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        {/* Outer wrapper — holds shadow (overflow visible) */}
        <View style={{
          width: w, height: h,
          borderRadius: 12,
          transform: [{ translateY: selected ? -6 : 0 }],
          // 3D shadow
          shadowColor: selected ? '#FACC15' : '#000',
          shadowOffset: { width: 0, height: selected ? 6 : 4 },
          shadowOpacity: selected ? 0.5 : 0.35,
          shadowRadius: selected ? 10 : 6,
          elevation: selected ? 10 : 6,
        }}>
          {/* Inner card — clips gradient to rounded rect */}
          <View style={{
            width: w, height: h,
            borderRadius: 12, overflow: 'hidden',
            backgroundColor: bg,
            borderWidth: selected ? 2.5 : 2,
            borderColor: selected ? '#FACC15' : borderColor,
            // ── 3D bottom edge ──
            borderBottomWidth: selected ? 6 : (small ? 4 : 5),
            borderBottomColor: selected ? '#B45309' : edge,
          }}>
            {/* Two-tone gradient fill */}
            {bgGradient && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <View style={{ flex: 1, backgroundColor: bgGradient[0] }} />
                <View style={{ flex: 1, backgroundColor: bgGradient[1] }} />
              </View>
            )}
            {/* Top glossy shine */}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: glossH,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderTopLeftRadius: 10, borderTopRightRadius: 10,
            }} />
            {/* Card content */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {children}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

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

function getNumCol(v: number) {
  if (v <= 9) return { border: '#60A5FA', grad: ['#3B82F6', '#0D9488'] as [string, string] };
  if (v <= 19) return { border: '#4ADE80', grad: ['#22C55E', '#0D9488'] as [string, string] };
  return { border: '#F87171', grad: ['#EF4444', '#E11D48'] as [string, string] };
}

function NumberCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const v = card.value ?? 0; const cl = getNumCol(v);
  return (
    <BaseCard borderColor={cl.border} bgGradient={cl.grad} selected={selected} onPress={onPress} small={small}>
      <Text style={{
        color: '#FFF', fontSize: small ? 18 : 28, fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
      }}>{v}</Text>
      {!small && (
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 8, marginTop: 1, fontWeight: '700', letterSpacing: 1 }}>מספר</Text>
      )}
    </BaseCard>
  );
}

const fDisp: Record<string, { n: string; d: string; s: string }> = { '1/2': { n: '1', d: '2', s: '½' }, '1/3': { n: '1', d: '3', s: '⅓' }, '1/4': { n: '1', d: '4', s: '¼' }, '1/5': { n: '1', d: '5', s: '⅕' } };

function FractionCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const f = fDisp[card.fraction ?? '1/2'];
  const ts = { color: '#FFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 } as any, textShadowRadius: 3 };
  return (
    <BaseCard borderColor="#A78BFA" bgGradient={['#8B5CF6', '#4338CA']} selected={selected} onPress={onPress} small={small}>
      {small
        ? <Text style={{ ...ts, fontSize: 20, fontWeight: '800' }}>{f.s}</Text>
        : <View style={{ alignItems: 'center' }}>
            <Text style={{ ...ts, fontSize: 20, fontWeight: '900', lineHeight: 24 }}>{f.n}</Text>
            <View style={{ width: 24, height: 2.5, backgroundColor: 'rgba(255,255,255,0.6)', marginVertical: 2, borderRadius: 2 }} />
            <Text style={{ ...ts, fontSize: 20, fontWeight: '900', lineHeight: 24 }}>{f.d}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, marginTop: 1, fontWeight: '700', letterSpacing: 1 }}>שבר</Text>
          </View>
      }
    </BaseCard>
  );
}

function OperationCardComp({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return (
    <BaseCard borderColor="#FB923C" bgGradient={['#F97316', '#DC2626']} selected={selected} onPress={onPress} small={small}>
      <Text style={{
        color: '#FFF', fontSize: small ? 22 : 32, fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
      }}>{card.operation}</Text>
      {!small && (
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, marginTop: 1, fontWeight: '700', letterSpacing: 1 }}>פעולה</Text>
      )}
    </BaseCard>
  );
}

function JokerCard({ card: _c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return (
    <BaseCard borderColor="#FCD34D" bgGradient={['#FACC15', '#D97706']} selected={selected} onPress={onPress} small={small}>
      <Text style={{
        color: '#FFF', fontSize: small ? 16 : 24,
        textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
      }}>★</Text>
      <Text style={{
        color: '#FFF', fontSize: small ? 10 : 14, fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
      }}>ג'וקר</Text>
    </BaseCard>
  );
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
  const count = state.drawPile.length;

  // Shared style for the stacked "ghost" cards behind the top card
  const ghost = (rotate: string, dx: number, dy: number, bg: string): any => ({
    position: 'absolute' as const, top: 4 + dy, left: 4 + dx,
    width: 72, height: 104, borderRadius: 12,
    backgroundColor: bg, borderWidth: 2, borderColor: '#818CF8',
    borderBottomWidth: 4, borderBottomColor: '#1E1B4B',
    transform: [{ rotate }],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3, elevation: 3,
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ position: 'relative', width: 84, height: 116 }}>
        {/* Bottom card — most rotated */}
        {count > 4 && <View style={ghost('-5deg', -4, 3, '#272362')} />}
        {/* Middle card */}
        {count > 2 && <View style={ghost('3.5deg', 3, -2, '#2D2878')} />}
        {/* Card just beneath top */}
        {count > 1 && <View style={ghost('-1.5deg', -1, 1, '#312E81')} />}
        {/* Tappable top card */}
        <View style={{ position: 'absolute', top: 4, left: 6 }}>
          <BaseCard faceDown onPress={canDraw ? () => dispatch({ type: 'DRAW_CARD' }) : undefined}><></></BaseCard>
        </View>
      </View>
      <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>{count}</Text>
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
  // Hide dice completely during fraction-attack phase
  if (state.phase === 'fraction-attack') return null;
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
//  JOKER CELEBRATION — Golden flash + confetti burst + text
// ═══════════════════════════════════════════════════════════════

const GOLD_SHADES = ['#FFD700', '#FFA500', '#FACC15', '#F59E0B', '#EAB308', '#FDE68A'];

function JokerCelebration() {
  const { dispatch } = useGame();
  const flashAnim = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const confettiPieces = useRef(
    Array.from({ length: 40 }, () => ({
      x: new Animated.Value(SCREEN_W / 2),
      y: new Animated.Value(SCREEN_H / 2),
      r: new Animated.Value(0),
      c: GOLD_SHADES[Math.floor(Math.random() * GOLD_SHADES.length)],
      targetX: Math.random() * SCREEN_W,
      targetY: Math.random() * SCREEN_H,
    }))
  ).current;

  useEffect(() => {
    // Golden flash
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0.25, duration: 350, useNativeDriver: true }),
    ]).start();

    // Text pop-in with spring
    Animated.parallel([
      Animated.spring(textScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Confetti burst from center
    confettiPieces.forEach((p) => {
      Animated.parallel([
        Animated.timing(p.x, { toValue: p.targetX, duration: 1200, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: p.targetY, duration: 1200, useNativeDriver: true }),
        Animated.timing(p.r, { toValue: Math.random() * 720 - 360, duration: 1200, useNativeDriver: true }),
      ]).start();
    });

    // Fade-out then dismiss
    const fadeTimer = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        dispatch({ type: 'HIDE_JOKER_CELEBRATION' });
      });
    }, 1800);
    return () => clearTimeout(fadeTimer);
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 9999, opacity: fadeOut }]} pointerEvents="none">
      {/* Golden flash overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFD700', opacity: flashAnim }]} />
      {/* Confetti burst */}
      {confettiPieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: i % 3 === 0 ? 14 : 10, height: i % 3 === 0 ? 14 : 10,
          borderRadius: i % 2 === 0 ? 7 : 2, backgroundColor: p.c,
          transform: [
            { translateX: p.x as any }, { translateY: p.y as any },
            { rotateZ: p.r.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) as any },
          ],
        }} />
      ))}
      {/* Text overlay */}
      <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: textScale as any }], opacity: textOpacity, alignItems: 'center' }}>
          <Text style={{
            fontSize: 48, fontWeight: '900', color: '#FFF',
            textShadowColor: '#B8860B', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 12,
            textAlign: 'center',
          }}>
            {'\u2605'} ג'וקר הופעל! {'\u2605'}
          </Text>
          <Text style={{
            fontSize: 20, fontWeight: '700', color: '#FEFCE8', textAlign: 'center', marginTop: 10,
            textShadowColor: '#B8860B', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
          }}>
            לוח הכפל שלך!
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  EQUATION BUILDER — Phase 2 (building) only
// ═══════════════════════════════════════════════════════════════

const SLOT_SZ = 46;
const OP_SZ = 32;

function EquationBuilder() {
  const { state, dispatch } = useGame();

  const [slots, setSlots] = useState<(number | null)[]>([null, null, null]);
  const [op1, setOp1] = useState('+');
  const [op2, setOp2] = useState('+');
  const [answer, setAnswer] = useState('');
  const [checkMsg, setCheckMsg] = useState('');
  const [selectedDie, setSelectedDie] = useState<number | null>(null);

  const diceKey = state.dice ? `${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  useEffect(() => {
    setSlots([null, null, null]); setOp1('+'); setOp2('+');
    setAnswer(''); setCheckMsg(''); setSelectedDie(null);
  }, [diceKey]);

  // Only show during building phase
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
      setSlots(next); setSelectedDie(null); setCheckMsg('');
    } else { setSelectedDie(dieIndex); }
  };

  const handleSlotTap = (slotIndex: number) => {
    const current = slots[slotIndex];
    if (current !== null) {
      const next = [...slots]; next[slotIndex] = null;
      setSlots(next); setCheckMsg(''); return;
    }
    if (selectedDie !== null) {
      const next = [...slots]; next[slotIndex] = selectedDie;
      setSlots(next); setSelectedDie(null); setCheckMsg('');
    }
  };

  const cycleOp = (cur: string) => EQ_OPS_STR[(EQ_OPS_STR.indexOf(cur) + 1) % EQ_OPS_STR.length];
  const slotVal = (i: number): number | null => slots[i] !== null ? diceValues[slots[i]!] : null;

  // Joker: convert game Operation format to equation format
  const jokerToEqOp = (op: Operation): string => {
    switch (op) { case 'x': return '*'; case '÷': return '/'; default: return op; }
  };
  const effectiveOp1 = state.jokerEquationActive && state.jokerEquationOp
    ? jokerToEqOp(state.jokerEquationOp)
    : op1;

  const handleConfirm = () => {
    // Block if joker active but no operation chosen
    if (state.jokerEquationActive && !state.jokerEquationOp) {
      setCheckMsg('יש לבחור פעולה לג\'וקר!'); return;
    }
    if (slotVal(0) === null || slotVal(1) === null) {
      setCheckMsg('הנח/י לפחות 2 קוביות!'); return;
    }
    const actual = computeSlotResult(slotVal(0), effectiveOp1, slotVal(1), op2, slotVal(2));
    if (actual === null || !Number.isInteger(actual) || actual < 0) {
      setCheckMsg('המשוואה אינה נכונה או חסרה!'); return;
    }
    const num = parseInt(answer, 10);
    if (isNaN(num) || num !== actual) {
      setCheckMsg('המשוואה אינה נכונה או חסרה!'); return;
    }
    if (!state.validTargets.some(t => t.result === actual)) {
      setCheckMsg('המשוואה אינה נכונה או חסרה!'); return;
    }
    dispatch({ type: 'CONFIRM_EQUATION', result: actual });
    // If cards are already selected during building, auto-discard them
    // React processes sequential dispatches in order, so DISCARD_AND_END
    // will see the solved state from CONFIRM_EQUATION
    if (state.selectedCards.length > 0) {
      dispatch({ type: 'DISCARD_AND_END' });
    }
  };

  const selNums = state.selectedCards.filter(c => c.type === 'number');
  const selectedSum = selNums.reduce((s, c) => s + (c.value ?? 0), 0);
  const hasCardsSelected = selNums.length > 0 && selNums.length === state.selectedCards.length;

  const renderSlot = (idx: number) => {
    const val = slotVal(idx);
    const isEmpty = val === null;
    return (
      <TouchableOpacity key={`slot-${idx}`} style={[eqS.slot, isEmpty ? eqS.slotEmpty : eqS.slotFilled]}
        onPress={() => handleSlotTap(idx)} activeOpacity={0.7}>
        {isEmpty ? null : <Text style={eqS.slotValue}>{val}</Text>}
      </TouchableOpacity>
    );
  };

  const opToDisplay = (v: string) => { switch (v) { case '*': return 'x'; case '/': return '÷'; default: return v; } };

  const renderOp = (value: string, setter: (v: string) => void, key: string) => (
    <TouchableOpacity key={key} style={eqS.opCircle}
      onPress={() => { setter(cycleOp(value)); setCheckMsg(''); }} activeOpacity={0.7}>
      <Text style={eqS.opCircleText}>{opToDisplay(value)}</Text>
    </TouchableOpacity>
  );

  // Joker operation circle — gold-bordered, tappable to reopen picker
  const renderJokerOp = () => (
    <TouchableOpacity key="joker-op" style={eqS.jokerOpCircle}
      onPress={() => dispatch({ type: 'REOPEN_JOKER_PICKER' })} activeOpacity={0.7}>
      <Text style={eqS.jokerOpStar}>{'\u2605'}</Text>
      {state.jokerEquationOp && <Text style={eqS.jokerOpText}>{state.jokerEquationOp}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={eqS.wrapper}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={eqS.title}>בנה/י משוואה מהקוביות</Text>
        {state.jokerEquationActive && (
          <View style={eqS.jokerBadge}>
            <Text style={eqS.jokerBadgeText}>{'\u2605'} ג'וקר פעיל</Text>
          </View>
        )}
      </View>
      <View style={eqS.poolRow}>
        {pool.map(i => (
          <TouchableOpacity key={`pool-${i}`} style={[eqS.poolDie, selectedDie === i && eqS.poolDieSelected]}
            onPress={() => handlePoolTap(i)} activeOpacity={0.7}>
            <Text style={eqS.poolDieText}>{diceValues[i]}</Text>
          </TouchableOpacity>
        ))}
        {pool.length === 0 && <Text style={eqS.poolHint}>כל הקוביות הוצבו</Text>}
      </View>
      <View style={eqS.eqRow}>
        {renderSlot(0)}
        {state.jokerEquationActive ? renderJokerOp() : renderOp(op1, setOp1, 'op1')}
        {renderSlot(1)}
        {renderOp(op2, setOp2, 'op2')}
        {renderSlot(2)}
        <Text style={eqS.equals}>=</Text>
        <TextInput style={eqS.inputBox} value={answer}
          onChangeText={t => { setAnswer(t); setCheckMsg(''); }}
          keyboardType="numeric" placeholder="?" placeholderTextColor="#555" textAlign="center" />
        <TouchableOpacity style={[eqS.checkBtn, hasCardsSelected && { backgroundColor: '#2563EB' }]} onPress={handleConfirm} activeOpacity={0.7}>
          <Text style={eqS.checkText}>{hasCardsSelected ? `אשר והנח (${selectedSum})` : 'אשר'}</Text>
        </TouchableOpacity>
      </View>
      {state.validTargets.length > 0 && (
        <Text style={eqS.hintText}>תוצאות אפשריות: {state.validTargets.map(t => t.result).join(', ')}</Text>
      )}
      {!!checkMsg && <View style={eqS.msgBox}><Text style={eqS.msgText}>{checkMsg}</Text></View>}
    </View>
  );
}

const JOKER_OP_SZ = 38;
const eqS = StyleSheet.create({
  wrapper: { backgroundColor: 'rgba(31,41,55,0.6)', borderRadius: 12, padding: 12, alignItems: 'center', gap: 10 },
  title: { color: '#93C5FD', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  jokerBadge: {
    backgroundColor: 'rgba(234,179,8,0.25)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.5)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  jokerBadgeText: { color: '#FDE68A', fontSize: 10, fontWeight: '700' },
  poolRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', minHeight: 42 },
  poolDie: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#93C5FD', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3 },
  poolDieSelected: { borderColor: '#FACC15', borderWidth: 2.5, shadowColor: '#FACC15', shadowOpacity: 0.4, elevation: 6 },
  poolDieText: { fontSize: 18, fontWeight: '800', color: '#1E40AF' },
  poolHint: { color: '#6B7280', fontSize: 11, fontStyle: 'italic' },
  eqRow: { flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 5 },
  slot: { width: SLOT_SZ, height: SLOT_SZ, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  slotEmpty: { backgroundColor: 'rgba(55,65,81,0.4)', borderWidth: 2, borderStyle: 'dashed', borderColor: '#6B7280' },
  slotFilled: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#3B82F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  slotValue: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  opCircle: { width: OP_SZ, height: OP_SZ, borderRadius: OP_SZ / 2, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  opCircleText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  jokerOpCircle: {
    width: JOKER_OP_SZ, height: JOKER_OP_SZ, borderRadius: JOKER_OP_SZ / 2,
    backgroundColor: '#FEFCE8', borderWidth: 2.5, borderColor: '#EAB308',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#EAB308', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 6,
  },
  jokerOpStar: { fontSize: 10, color: '#CA8A04', marginTop: -1 },
  jokerOpText: { fontSize: 13, fontWeight: '900', color: '#92400E', marginTop: -2 },
  equals: { fontSize: 22, fontWeight: '800', color: '#9CA3AF', marginHorizontal: 2 },
  inputBox: { width: SLOT_SZ, height: SLOT_SZ, borderRadius: 10, backgroundColor: '#1F2937', borderWidth: 2, borderColor: '#4B5563', color: '#FFF', fontSize: 20, fontWeight: '800', padding: 0 },
  checkBtn: { backgroundColor: '#16A34A', paddingHorizontal: 12, height: SLOT_SZ, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  hintText: { color: '#6B7280', fontSize: 11, textAlign: 'center' },
  msgBox: { backgroundColor: 'rgba(234,179,8,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, width: '100%' },
  msgText: { color: '#FDE68A', fontSize: 13, textAlign: 'center', fontWeight: '600' },
});

// ═══════════════════════════════════════════════════════════════
//  FRACTION ATTACK BANNER — Shown during fraction-attack phase
// ═══════════════════════════════════════════════════════════════

function FractionAttackBanner() {
  const { state, dispatch } = useGame();
  if (state.phase !== 'fraction-attack') return null;

  const cp = state.players[state.currentPlayerIndex];
  const hasMatchingNumber = cp?.hand.some(c => c.type === 'number' && c.value === state.pendingFractionTarget);
  const hasBlockingFraction = cp?.hand.some(c => {
    if (c.type !== 'fraction' || !c.fraction) return false;
    const d = fractionDenominator(c.fraction as Fraction);
    return state.pendingFractionTarget !== null && state.pendingFractionTarget % d === 0;
  });

  return (
    <View style={fabS.container}>
      {/* Danger header */}
      <View style={fabS.header}>
        <Text style={fabS.headerIcon}>⚠️</Text>
        <Text style={fabS.headerText}>הותקפת בשבר!</Text>
      </View>

      {/* Target display: original ÷ denom = result */}
      {state.originalTargetValue !== null && state.attackingFraction && (
        <View style={fabS.targetRow}>
          <Text style={fabS.origValue}>{state.originalTargetValue}</Text>
          <Text style={fabS.divSign}>÷</Text>
          <Text style={fabS.fracValue}>{fractionDenominator(state.attackingFraction)}</Text>
          <Text style={fabS.eqSign}>=</Text>
          <Text style={fabS.resultValue}>{state.pendingFractionTarget}</Text>
        </View>
      )}

      {/* Instructions */}
      <Text style={fabS.instruction}>
        הנח קלף {state.pendingFractionTarget} • חסום עם שבר • או משוך {state.fractionPenalty} קלפים
      </Text>

      {/* Action buttons */}
      <View style={fabS.btnRow}>
        {hasMatchingNumber && (
          <Text style={fabS.hint}>לחץ/י על קלף {state.pendingFractionTarget} מהיד כדי להגן</Text>
        )}
        {hasBlockingFraction && (
          <Text style={fabS.hint}>לחץ/י על קלף שבר מהיד כדי לחסום</Text>
        )}
        <Btn variant="danger" size="md" onPress={() => dispatch({ type: 'FRACTION_DRAW_PENALTY' })}>
          {`משוך ${state.fractionPenalty} קלפים`}
        </Btn>
      </View>
    </View>
  );
}
const fabS = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(127,29,29,0.35)', borderWidth: 2, borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: 14, padding: 16, gap: 12, alignItems: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 28 },
  headerText: { color: '#FCA5A5', fontSize: 20, fontWeight: '900' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, direction: 'ltr' as any },
  origValue: { color: '#D1D5DB', fontSize: 28, fontWeight: '800' },
  divSign: { color: '#9CA3AF', fontSize: 24, fontWeight: '700' },
  fracValue: { color: '#A78BFA', fontSize: 28, fontWeight: '800' },
  eqSign: { color: '#9CA3AF', fontSize: 24, fontWeight: '700' },
  resultValue: { color: '#EF4444', fontSize: 32, fontWeight: '900' },
  instruction: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  btnRow: { alignItems: 'center', gap: 8, width: '100%' },
  hint: { color: '#86EFAC', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════
//  ACTION BAR — Phase-aware buttons
// ═══════════════════════════════════════════════════════════════

function ActionBar() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  if (!cp) return null;

  const isPreRoll = state.phase === 'pre-roll';
  const isBuilding = state.phase === 'building';
  const isSolved = state.phase === 'solved';
  const hp = state.hasPlayedCards;

  // Challenge states (operation only — fraction attacks use FractionAttackBanner)
  const hasOpChallenge = isPreRoll && !!state.activeOperation && !hp;

  // Solved phase: select cards to discard
  const selNums = state.selectedCards.filter(c => c.type === 'number');
  const selectedSum = selNums.reduce((s, c) => s + (c.value ?? 0), 0);
  const canDiscard = isSolved && !hp && selNums.length > 0 && selNums.length === state.selectedCards.length;

  const canCallLolos = (isPreRoll || isSolved) && cp.hand.length <= 2 && !cp.calledLolos && !hasOpChallenge;

  return (
    <View style={aS.container}>
      {/* Phase 1: Operation challenge */}
      {hasOpChallenge && (
        <View style={aS.opSec}>
          <Text style={aS.opT}>אתגר פעולה: {state.activeOperation}</Text>
          <Text style={aS.opH}>הגן/י עם קלף פעולה תואם או ג'וקר, או קבל/י עונש.</Text>
          <Btn variant="danger" size="sm" onPress={() => dispatch({ type: 'END_TURN' })}>קבל/י עונש</Btn>
        </View>
      )}

      {/* Phase 2: Building — draw card to skip */}
      {isBuilding && !hp && (
        <View style={aS.row}>
          <Btn variant="secondary" size="sm" onPress={() => dispatch({ type: 'DRAW_CARD' })}>שלוף קלף (ויתור)</Btn>
        </View>
      )}

      {/* Phase 3: Solved — banner */}
      {isSolved && !hp && (
        <View style={aS.solvedBanner}>
          <Text style={aS.solvedText}>משוואה פתורה! תוצאה: {state.equationResult}</Text>
          <Text style={aS.solvedHint}>בחר/י קלפי מספר מהיד שסכומם {state.equationResult}</Text>
        </View>
      )}

      {/* Phase 4: Confirm — אשר button (equation solved + cards selected) */}
      {canDiscard && (
        <View style={aS.row}>
          <Btn variant="success" onPress={() => dispatch({ type: 'DISCARD_AND_END' })}>
            {`אשר והנח (${selectedSum})`}
          </Btn>
        </View>
      )}

      {/* End turn after playing cards */}
      {(isPreRoll || isSolved) && hp && (
        <View style={aS.row}>
          <Btn variant="secondary" onPress={() => dispatch({ type: 'END_TURN' })}>סיים תור</Btn>
        </View>
      )}

      {/* Lolos button */}
      {canCallLolos && (
        <View style={aS.row}>
          <Btn variant="gold" size="lg" onPress={() => dispatch({ type: 'CALL_LOLOS' })}>לולוס!</Btn>
        </View>
      )}

      {/* Messages */}
      {!!state.message && <View style={aS.msg}><Text style={aS.msgT}>{state.message}</Text></View>}

      {/* Joker operation picker — hidden during celebration */}
      <AppModal
        visible={state.jokerModalOpen && !state.jokerCelebration}
        onClose={() => dispatch({ type: 'CLOSE_JOKER_MODAL' })}
        title="איזו פעולה הג'וקר מייצג?"
      >
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#FDE68A', fontSize: 36 }}>{'\u2605'}</Text>
          <Text style={{ color: '#D1D5DB', fontSize: 14, textAlign: 'center', marginTop: 4 }}>
            {state.jokerEquationActive
              ? 'שנה/י את פעולת הג\'וקר במשוואה'
              : 'בחר/י פעולה עבור הג\'וקר'}
          </Text>
        </View>
        <View style={aS.jGrid}>
          {(['+', '-', 'x', '÷'] as Operation[]).map(op => (
            <TouchableOpacity key={op} style={aS.jBtn} activeOpacity={0.7}
              onPress={() => {
                const j = state.selectedCards[0];
                if (j) dispatch({ type: 'PLAY_JOKER', card: j, chosenOperation: op });
                else if (state.jokerEquationActive && state.jokerCard)
                  dispatch({ type: 'PLAY_JOKER', card: state.jokerCard, chosenOperation: op });
              }}>
              <Text style={aS.jBtnText}>{op}</Text>
            </TouchableOpacity>
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
  opH: { color: '#9CA3AF', fontSize: 11, marginBottom: 8 },
  msg: { backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 10, padding: 10, alignItems: 'center' },
  msgT: { color: '#FDE68A', fontSize: 13, textAlign: 'center' },
  jGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingBottom: 8 },
  jBtn: {
    width: '42%', minWidth: 100, aspectRatio: 1.6,
    backgroundColor: '#1F2937', borderWidth: 2.5, borderColor: '#EAB308',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#EAB308', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  jBtnText: { fontSize: 36, fontWeight: '900', color: '#FACC15' },
  solvedBanner: {
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  solvedText: { color: '#4ADE80', fontSize: 15, fontWeight: '700' },
  solvedHint: { color: '#86EFAC', fontSize: 12, marginTop: 4 },
});

// ═══════════════════════════════════════════════════════════════
//  PLAYER HAND — Phase-aware opacity & interaction
// ═══════════════════════════════════════════════════════════════

function PlayerHand() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  if (!cp) return null;

  const isPreRoll = state.phase === 'pre-roll';
  const isBuilding = state.phase === 'building';
  const isSolved = state.phase === 'solved';
  const isFractionAttack = state.phase === 'fraction-attack';
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  // Challenge in pre-roll (operation only)
  const hasOpChallenge = isPreRoll && !!state.activeOperation && !state.hasPlayedCards;

  const sorted = [...cp.hand].sort((a, b) => {
    const o = { number: 0, fraction: 1, operation: 2, joker: 3 } as const;
    if (o[a.type] !== o[b.type]) return o[a.type] - o[b.type];
    if (a.type === 'number' && b.type === 'number') return (a.value ?? 0) - (b.value ?? 0);
    return 0;
  });

  const handleCardTap = (card: Card) => {
    // Phase 2: building → select number cards for discard while building equation
    if (isBuilding && !state.hasPlayedCards) {
      if (card.type === 'number') {
        dispatch({ type: 'SELECT_CARD', card });
      } else if (card.type === 'joker') {
        if (state.jokerEquationActive) {
          dispatch({ type: 'SET_MESSAGE', message: "כבר יש ג'וקר במשוואה! לחץ/י עליו כדי לשנות פעולה." });
        } else {
          dispatch({ type: 'OPEN_JOKER_MODAL', card });
        }
      }
      return;
    }

    // Phase 1: pre-roll
    if (isPreRoll) {
      // Operation challenge defense
      if (hasOpChallenge) {
        if (card.type === 'operation' && card.operation === state.activeOperation) {
          dispatch({ type: 'PLAY_OPERATION', card });
        } else if (card.type === 'joker') {
          dispatch({ type: 'OPEN_JOKER_MODAL', card });
        }
        return;
      }
      // Normal pre-roll: identical matching or fraction attack
      if (validateIdenticalPlay(card, topDiscard)) {
        dispatch({ type: 'PLAY_IDENTICAL', card });
      } else if (card.type === 'fraction' && !state.hasPlayedCards) {
        // Fraction attack from pre-roll
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      return;
    }

    // Fraction-attack phase: defend with number, block with fraction
    if (isFractionAttack) {
      if (card.type === 'number' && card.value === state.pendingFractionTarget) {
        dispatch({ type: 'FRACTION_DEFEND_SOLVE', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'FRACTION_DEFEND_BLOCK', card });
      }
      return;
    }

    // Phase 3: solved → select cards or attack with fraction
    if (isSolved && !state.hasPlayedCards) {
      if (card.type === 'number') {
        dispatch({ type: 'SELECT_CARD', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      } else if (card.type === 'operation') {
        dispatch({ type: 'PLAY_OPERATION', card });
      } else if (card.type === 'joker') {
        if (state.jokerEquationActive) {
          dispatch({ type: 'SET_MESSAGE', message: "כבר יש ג'וקר במשוואה! לחץ/י עליו כדי לשנות פעולה." });
        } else {
          dispatch({ type: 'OPEN_JOKER_MODAL', card });
        }
      }
      return;
    }
  };

  const isCardTappable = (card: Card): boolean => {
    if (isBuilding && !state.hasPlayedCards) return card.type === 'number' || card.type === 'joker';
    if (isFractionAttack) {
      // Can tap: matching number card to solve, or fraction card to block
      if (card.type === 'number' && card.value === state.pendingFractionTarget) return true;
      if (card.type === 'fraction' && card.fraction) {
        const d = fractionDenominator(card.fraction as Fraction);
        return state.pendingFractionTarget !== null && state.pendingFractionTarget % d === 0;
      }
      return false;
    }
    if (isPreRoll) {
      if (hasOpChallenge) return (card.type === 'operation' && card.operation === state.activeOperation) || card.type === 'joker';
      // Allow identical matching and fraction attacks in pre-roll
      if (card.type === 'fraction' && !state.hasPlayedCards) return validateFractionPlay(card, topDiscard);
      return validateIdenticalPlay(card, topDiscard);
    }
    if (isSolved && !state.hasPlayedCards) return true;
    return false;
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
          const tappable = isCardTappable(card);
          return <GameCard key={card.id} card={card} selected={sel} small onPress={tappable ? () => handleCardTap(card) : undefined} />;
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
            'פתור את המשוואה קודם — רק אז תוכל/י לבחור קלפים מהיד.',
            'שחק/י קלפי מספר מהיד שסכומם שווה לתוצאת המשוואה.',
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
  const isUnderAttack = state.pendingFractionTarget !== null;
  return (
    <View style={ttS.container}>
      <TouchableOpacity style={ttS.exit} onPress={() => dispatch({ type: 'RESET_GAME' })}>
        <Text style={ttS.exitT}>יציאה</Text>
      </TouchableOpacity>
      <Text style={{ color: '#9CA3AF', fontSize: 14 }}>העבר/י את המכשיר ל</Text>
      <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 8 }}>{cp?.name}</Text>
      <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8 }}>{cp?.hand.length} קלפים ביד</Text>
      {isUnderAttack && (
        <View style={[ttS.msgBox, { backgroundColor: 'rgba(220,38,38,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }]}>
          <Text style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '900', textAlign: 'center' }}>⚠️ הותקפת בשבר!</Text>
          <Text style={{ color: '#FCA5A5', fontSize: 14, textAlign: 'center', marginTop: 4 }}>
            הנח {state.pendingFractionTarget} או משוך {state.fractionPenalty} קלפים
          </Text>
        </View>
      )}
      {!!state.message && !isUnderAttack && <View style={ttS.msgBox}><Text style={ttS.msgT}>{state.message}</Text></View>}
      <Btn variant={isUnderAttack ? 'danger' : 'primary'} size="lg" onPress={() => dispatch({ type: 'BEGIN_TURN' })} style={{ width: '100%', marginTop: 24 }}>
        {isUnderAttack ? 'ראה התקפה' : 'אני מוכן/ה'}
      </Btn>
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
  // Celebration is now driven by state.jokerCelebration

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
        <FractionAttackBanner />
        <EquationBuilder />
        <ActionBar />
      </ScrollView>

      <View style={gsS.hand}>
        <PlayerHand />
      </View>

      {state.jokerCelebration && <JokerCelebration />}
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
//  ROUTER + APP
// ═══════════════════════════════════════════════════════════════

function GameRouter() {
  const { state } = useGame();
  switch (state.phase) {
    case 'setup': return <StartScreen />;
    case 'turn-transition': return <TurnTransition />;
    case 'pre-roll':
    case 'building':
    case 'solved':
    case 'fraction-attack': return <GameScreen />;
    case 'game-over': return <GameOver />;
    default: return <StartScreen />;
  }
}

export default function App() {
  return (
    <GameProvider>
      <StatusBar style="light" />
      <GameRouter />
    </GameProvider>
  );
}
