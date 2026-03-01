// ============================================================
// index.tsx — Lolos Card Game — FULL SINGLE FILE
// LinearGradient cards, 3D shadows, rotated deck, thick edges
// ============================================================

import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  I18nManager, View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, Animated, Easing, Dimensions, Modal as RNModal, Platform, PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { registerRootComponent } from 'expo';
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import Svg, { Circle as SvgCircle, Rect as SvgRect, Path as SvgPath, Polygon as SvgPolygon } from 'react-native-svg';
import { DiceWebView, DiceWebViewRef } from './components/DiceWebView';
import { LulosButton } from './components/LulosButton';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';


I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════
//  SHARED SAFE AREA — single source of truth for bottom positioning
// ═══════════════════════════════════════════════════════════════
const ZONE_F_APPROX_H = 90; // approx height of Zone F (action buttons + controls bar)

function useGameSafeArea() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 20);
  return {
    safeBottom,
    /** Bottom padding for Zone F content — keeps everything above home indicator */
    SAFE_BOTTOM_PAD: safeBottom + 16,
    /** Bottom position for floating overlays (above action controls) */
    OVERLAY_BOTTOM: safeBottom + ZONE_F_APPROX_H,
    /** Bottom position for challenge curtain peek tab */
    CURTAIN_PEEK_BOTTOM: safeBottom + ZONE_F_APPROX_H + 24,
    insets,
  };
}

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
  stagedCards: Card[];
  validTargets: EquationOption[];
  equationResult: number | null;
  activeOperation: Operation | null;
  activeFraction: Fraction | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  identicalAlert: { playerName: string; cardDisplay: string; consecutive: number } | null;
  defenseSelectMode: boolean;
  jokerModalOpen: boolean;
  equationOpCard: Card | null;
  equationOpPosition: number | null;
  equationOpJokerOp: Operation | null;
  lastMoveMessage: string | null;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  showFractions: boolean;
  showPossibleResults: boolean;
  winner: Player | null;
  message: string;
  roundsPlayed: number;
}

type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full'; fractions: boolean; showPossibleResults: boolean }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE'; values?: DiceResult }
  | { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string }
  | { type: 'REVERT_TO_BUILDING' }
  | { type: 'STAGE_CARD'; card: Card }
  | { type: 'UNSTAGE_CARD'; card: Card }
  | { type: 'CONFIRM_STAGED' }
  | { type: 'CONFIRM_TRAP_ONLY' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'PLAY_OPERATION'; card: Card }
  | { type: 'SELECT_EQ_OP'; card: Card }
  | { type: 'PLACE_EQ_OP'; position: number }
  | { type: 'REMOVE_EQ_OP' }
  | { type: 'SELECT_EQ_JOKER'; card: Card; chosenOperation: Operation }
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
  | { type: 'DISMISS_IDENTICAL_ALERT' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SET_DEFENSE_SELECT_MODE'; enabled: boolean }
  | { type: 'RESET_GAME' };

// ═══════════════════════════════════════════════════════════════
//  ARITHMETIC — strict Left-to-Right
// ═══════════════════════════════════════════════════════════════

function applyOperation(a: number, op: Operation | string, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function isHighPrecedence(op: string): boolean {
  return op === 'x' || op === '×' || op === '*' || op === '÷' || op === '/';
}

/** Evaluate a op1 b op2 c with standard order of operations (× ÷ before + −) */
function evalThreeTerms(a: number, op1: string, b: number, op2: string, c: number): number | null {
  if (isHighPrecedence(op2) && !isHighPrecedence(op1)) {
    // op2 has higher precedence: compute b op2 c first
    const right = applyOperation(b, op2, c);
    if (right === null) return null;
    return applyOperation(a, op1, right);
  }
  // op1 has equal or higher precedence: left-to-right
  const left = applyOperation(a, op1, b);
  if (left === null) return null;
  return applyOperation(left, op2, c);
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

function getEqOpCardOperation(state: GameState): Operation | null {
  if (!state.equationOpCard) return null;
  return state.equationOpCard.type === 'joker'
    ? state.equationOpJokerOp
    : state.equationOpCard.operation ?? null;
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

function generateDeck(difficulty: 'easy' | 'full', includeFractions: boolean = true): Card[] {
  cardIdCounter = 0;
  const cards: Card[] = [];
  const maxNumber = difficulty === 'easy' ? 12 : 25;
  for (let set = 0; set < 4; set++)
    for (let v = 0; v <= maxNumber; v++)
      cards.push({ id: makeId(), type: 'number', value: v });
  if (includeFractions) {
    const fracs: { frac: Fraction; count: number }[] = [
      { frac: '1/2', count: 6 }, { frac: '1/3', count: 4 },
      { frac: '1/4', count: 4 }, { frac: '1/5', count: 4 },
    ];
    for (const { frac, count } of fracs)
      for (let i = 0; i < count; i++)
        cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  }
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
        // Standard order of operations
        const r = evalThreeTerms(a, op1, b, op2, c);
        if (r !== null && r >= 0 && Number.isInteger(r)) {
          const eq = `${a} ${op1} ${b} ${op2} ${c} = ${r}`;
          if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push({ equation: eq, result: r }); }
        }
        // Left-to-right step-by-step: (a op1 b) op2 c — for the 2-row equation UI
        const lr1 = applyOperation(a, op1, b);
        if (lr1 !== null) {
          const lr = applyOperation(lr1, op2, c);
          if (lr !== null && lr >= 0 && Number.isInteger(lr)) {
            const eq2 = `(${a} ${op1} ${b}) ${op2} ${c} = ${lr}`;
            if (!seen.has(`${lr}:${eq2}`)) { seen.add(`${lr}:${eq2}`); results.push({ equation: eq2, result: lr }); }
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

function getStagedPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getStagedPermutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

function validateStagedCards(numberCards: Card[], opCard: Card | null, target: number): boolean {
  const values = numberCards.map(c => c.value ?? 0);
  if (values.length === 0) return false;
  if (!opCard) {
    // No operator → sum all numbers
    return values.reduce((s, v) => s + v, 0) === target;
  }
  const op = opCard.operation!;
  // Try every permutation of number values × every operator gap position
  const perms = getStagedPermutations(values);
  for (const perm of perms) {
    for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
      // Evaluate left-to-right: default + except at gapPos where op is used
      let result: number | null = perm[0];
      for (let i = 1; i < perm.length; i++) {
        const useOp = i - 1 === gapPos ? op : '+';
        result = applyOperation(result!, useOp as Operation, perm[i]);
        if (result === null) break;
      }
      if (result !== null && result === target) return true;
    }
  }
  return false;
}

function computeStagedResult(staged: Card[]): number | null {
  // Evaluate staged cards left-to-right in tap order
  // Numbers separated by default +, unless an operator card appears between them
  const parsed: ({ type: 'num'; value: number } | { type: 'op'; op: Operation })[] = [];
  for (const c of staged) {
    if (c.type === 'number') parsed.push({ type: 'num', value: c.value ?? 0 });
    else if (c.type === 'operation') parsed.push({ type: 'op', op: c.operation! });
  }
  if (parsed.length === 0) return null;
  // Build evaluation: insert default + between consecutive numbers
  let result: number | null = null;
  let pendingOp: Operation = '+';
  for (const item of parsed) {
    if (item.type === 'num') {
      if (result === null) { result = item.value; }
      else { result = applyOperation(result, pendingOp, item.value); pendingOp = '+'; }
      if (result === null) return null;
    } else {
      pendingOp = item.op;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  GAME REDUCER
// ═══════════════════════════════════════════════════════════════

const CARDS_PER_PLAYER = 10;

const initialState: GameState = {
  phase: 'setup', players: [], currentPlayerIndex: 0, drawPile: [], discardPile: [],
  dice: null, selectedCards: [], stagedCards: [], validTargets: [], equationResult: null,
  activeOperation: null, activeFraction: null, pendingFractionTarget: null,
  fractionPenalty: 0, fractionAttackResolved: false, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
  consecutiveIdenticalPlays: 0, identicalAlert: null, defenseSelectMode: false, jokerModalOpen: false, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null,
  lastMoveMessage: null, lastEquationDisplay: null,
  difficulty: 'full', showFractions: true, showPossibleResults: true, winner: null, message: '',
  roundsPlayed: 0,
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
    selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
    activeOperation: keepOp ? s.activeOperation : null,
    activeFraction: null, identicalAlert: null, hasPlayedCards: false,
    hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null,
    fractionPenalty: 0, defenseSelectMode: false, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null,
    roundsPlayed: s.roundsPlayed + 1,
  };
}

function gameReducer(st: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const deck = shuffle(generateDeck(action.difficulty, action.fractions));
      const { hands, remaining } = dealCards(deck, action.players.length, CARDS_PER_PLAYER);
      let drawPile = remaining;
      let firstDiscard: Card | undefined;
      for (let i = 0; i < drawPile.length; i++) {
        if (drawPile[i].type === 'number' || drawPile[i].type === 'fraction') {
          firstDiscard = drawPile[i];
          drawPile = [...drawPile.slice(0, i), ...drawPile.slice(i + 1)];
          break;
        }
      }
      if (!firstDiscard) { firstDiscard = drawPile[0]; drawPile = drawPile.slice(1); }
      return {
        ...initialState, phase: 'turn-transition', difficulty: action.difficulty,
        showFractions: action.fractions, showPossibleResults: action.showPossibleResults,
        players: action.players.map((p, i) => ({ id: i, name: p.name, hand: hands[i], calledLolos: false })),
        drawPile, discardPile: firstDiscard ? [firstDiscard] : [],
      };
    }
    case 'NEXT_TURN': {
      const next = (st.currentPlayerIndex + 1) % st.players.length;
      return { ...st, players: st.players.map(p => ({ ...p, calledLolos: false })), currentPlayerIndex: next, phase: 'turn-transition', dice: null, selectedCards: [], stagedCards: [], equationResult: null, validTargets: [], message: '', activeOperation: null, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: false, defenseSelectMode: false, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null };
    }
    case 'BEGIN_TURN': {
      if (st.activeOperation) {
        const cp = st.players[st.currentPlayerIndex];
        const has = cp.hand.some(c => (c.type === 'operation' && c.operation === st.activeOperation) || c.type === 'joker');
        if (has) return { ...st, phase: 'pre-roll', message: `פעולת ${st.activeOperation}! שחק/י קלף פעולה תואם או ג'וקר כדי להגן.` };
        let s = drawFromPile(st, 2, st.currentPlayerIndex);
        return { ...s, phase: 'pre-roll', activeOperation: null, message: `אין הגנה מפני ${st.activeOperation}! שלפת 2 קלפי עונשין.` };
      }
      // Fraction attack: explicit pending attack (from PLAY_FRACTION)
      if (st.pendingFractionTarget !== null && !st.fractionAttackResolved) {
        return { ...st, phase: 'pre-roll', message: '' };
      }
      // Fraction attack: auto-detect fraction card on top of discard pile
      const topDiscard = st.discardPile[st.discardPile.length - 1];
      if (topDiscard && topDiscard.type === 'fraction') {
        const denom = fractionDenominator(topDiscard.fraction!);
        return { ...st, phase: 'pre-roll', pendingFractionTarget: denom, fractionPenalty: denom, fractionAttackResolved: false, message: '' };
      }
      // Normal turn — reset the resolved flag
      return { ...st, phase: 'pre-roll', fractionAttackResolved: false, pendingFractionTarget: null, fractionPenalty: 0, message: '' };
    }
    case 'ROLL_DICE': {
      if (st.phase !== 'pre-roll') return st;
      const dice = action.values || rollDiceUtil();
      let ns: GameState = { ...st, dice };
      if (isTriple(dice)) {
        let s = { ...ns, players: ns.players.map(p => ({ ...p, hand: [...p.hand] })) };
        for (let i = 0; i < s.players.length; i++) if (i !== st.currentPlayerIndex) s = drawFromPile(s, dice.die1, i);
        s.message = `שלישייה של ${dice.die1}! כל שאר השחקנים שולפים ${dice.die1} קלפים!`;
        ns = s;
      }
      const vt = generateValidTargets(dice);
      return { ...ns, validTargets: vt, phase: 'building', activeOperation: null, consecutiveIdenticalPlays: 0, message: ns.message || '' };
    }
    case 'CONFIRM_EQUATION': {
      if (st.phase !== 'building') return st;
      return { ...st, phase: 'solved', equationResult: action.result, lastEquationDisplay: action.equationDisplay, stagedCards: [], message: '' };
    }
    case 'REVERT_TO_BUILDING': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      return { ...st, phase: 'building', equationResult: null, lastEquationDisplay: null, stagedCards: [], message: '' };
    }
    case 'STAGE_CARD': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      if (st.stagedCards.some(c => c.id === action.card.id)) return st;
      if (action.card.type !== 'number' && action.card.type !== 'operation') return st;
      // Don't allow staging the card that's committed to the equation
      if (st.equationOpCard && action.card.id === st.equationOpCard.id) return st;
      // Max 1 operator in staging zone
      if (action.card.type === 'operation' && st.stagedCards.some(c => c.type === 'operation')) {
        return { ...st, message: 'אפשר רק סימן פעולה אחד באזור ההנחה' };
      }
      return { ...st, stagedCards: [...st.stagedCards, action.card], message: '' };
    }
    case 'UNSTAGE_CARD': {
      if (st.phase !== 'solved') return st;
      return { ...st, stagedCards: st.stagedCards.filter(c => c.id !== action.card.id), message: '' };
    }
    case 'CONFIRM_STAGED': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      const stNumbers = st.stagedCards.filter(c => c.type === 'number');
      const stOpCards = st.stagedCards.filter(c => c.type === 'operation');
      const stOpCard = stOpCards.length === 1 ? stOpCards[0] : null;
      if (stNumbers.length === 0) return { ...st, message: 'יש לבחור לפחות קלף מספר אחד' };
      if (st.equationResult === null) return st;
      if (!validateStagedCards(stNumbers, stOpCard, st.equationResult)) {
        return { ...st, message: 'השילוב הזה לא מגיע לתוצאה, נסה לשנות' };
      }
      // Valid — remove staged cards + equation operator card from hand
      const stIds = new Set(st.stagedCards.map(c => c.id));
      if (st.equationOpCard && st.equationOpPosition !== null) stIds.add(st.equationOpCard.id);
      const stCp = st.players[st.currentPlayerIndex];
      const stNp = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: stCp.hand.filter(c => !stIds.has(c.id)) } : p);
      // Build discard: number cards first, then operator last (on top)
      const stDiscard = [...st.discardPile, ...stNumbers];
      if (stOpCard) stDiscard.push(stOpCard);
      if (st.equationOpCard && st.equationOpPosition !== null) stDiscard.push(st.equationOpCard);
      // Determine activeOperation challenge for next player:
      // Position C (trailing) equation operator takes priority, then staging zone operator
      const eqOp = st.equationOpCard?.type === 'joker' ? st.equationOpJokerOp : st.equationOpCard?.operation;
      const eqChallenge = (st.equationOpCard && st.equationOpPosition === 2) ? eqOp! : null;
      const stNewActiveOp = eqChallenge ?? (stOpCard ? stOpCard.operation! : null);
      const stLastNum = stNumbers[stNumbers.length - 1];
      const stToast = stNewActiveOp
        ? `⚔️ ${stCp.name}: הניח סימן ${stNewActiveOp} — אתגר!`
        : `✅ ${stCp.name}: ${st.lastEquationDisplay || ''} → הניח ${stLastNum.value}`;
      let stNs: GameState = { ...st, players: stNp, discardPile: stDiscard, stagedCards: [], selectedCards: [], consecutiveIdenticalPlays: 0, hasPlayedCards: true, lastCardValue: stLastNum.value ?? null, activeOperation: stNewActiveOp ?? st.activeOperation, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null, lastMoveMessage: stToast, lastEquationDisplay: null, message: stNewActiveOp ? `אתגר פעולה ${stNewActiveOp} לשחקן הבא!` : '' };
      stNs = checkWin(stNs);
      if (stNs.phase === 'game-over') return stNs;
      return endTurnLogic(stNs);
    }
    case 'CONFIRM_TRAP_ONLY': {
      // Place trap operation card without solving equation
      if (st.phase !== 'building' && st.phase !== 'solved') return st;
      if (st.hasPlayedCards) return st;
      if (!st.equationOpCard || st.equationOpPosition !== 2) return st;
      const trapOp = st.equationOpCard.type === 'joker' ? st.equationOpJokerOp : st.equationOpCard.operation;
      if (!trapOp) return st;
      const trapCp = st.players[st.currentPlayerIndex];
      const trapNp = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: trapCp.hand.filter(c => c.id !== st.equationOpCard!.id) } : p);
      const trapDiscard = [...st.discardPile, st.equationOpCard];
      let trapNs: GameState = { ...st, players: trapNp, discardPile: trapDiscard, stagedCards: [], selectedCards: [], consecutiveIdenticalPlays: 0, hasPlayedCards: true, lastCardValue: st.lastCardValue, activeOperation: trapOp, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null, lastMoveMessage: `⚔️ ${trapCp.name}: הניח מלכודת ${trapOp} — אתגר!`, lastEquationDisplay: null, message: `אתגר פעולה ${trapOp} לשחקן הבא!` };
      trapNs = checkWin(trapNs);
      if (trapNs.phase === 'game-over') return trapNs;
      return endTurnLogic(trapNs);
    }
    case 'PLAY_IDENTICAL': {
      if (st.phase !== 'pre-roll') return st;
      if (st.consecutiveIdenticalPlays >= 2) return st;
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateIdenticalPlay(action.card, td)) return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      const newConsecutive = st.consecutiveIdenticalPlays + 1;
      const cardDisplay = action.card.type === 'number' ? `${action.card.value}` :
                          action.card.type === 'fraction' ? action.card.fraction! :
                          action.card.type === 'operation' ? action.card.operation! : 'ג׳וקר';
      let ns: GameState = {
        ...st, players: np, discardPile: [...st.discardPile, action.card],
        selectedCards: [], hasPlayedCards: true,
        consecutiveIdenticalPlays: newConsecutive,
        lastCardValue: action.card.type === 'number' ? action.card.value ?? null : null,
        identicalAlert: { playerName: cp.name, cardDisplay, consecutive: newConsecutive },
        message: '',
      };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return { ...ns, identicalAlert: null };
      return ns; // Stay — modal shown, DISMISS_IDENTICAL_ALERT will call endTurnLogic
    }
    case 'DISMISS_IDENTICAL_ALERT': {
      const idToast = st.identicalAlert
        ? `🔄 ${st.identicalAlert.playerName}: הניח קלף זהה (${st.identicalAlert.cardDisplay}) — דילוג על קוביות`
        : null;
      return endTurnLogic({ ...st, identicalAlert: null, lastMoveMessage: idToast });
    }
    case 'PLAY_OPERATION': {
      if (st.phase !== 'pre-roll' && st.phase !== 'solved') return st;
      if (st.hasPlayedCards || action.card.type !== 'operation') return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.card.operation!, selectedCards: [], hasPlayedCards: true, message: '' };
      ns = checkWin(ns);
      return ns;
    }
    // ── Equation operator placement (building phase only) ──
    case 'SELECT_EQ_OP': {
      console.log('[REDUCER] SELECT_EQ_OP', 'phase=', st.phase, 'existing=', st.equationOpCard?.operation, 'card=', action.card.operation);
      if (st.phase !== 'building') return st;
      if (st.equationOpCard && st.equationOpPosition !== null) return st;
      if (action.card.type !== 'operation') return st;
      return { ...st, equationOpCard: action.card, equationOpJokerOp: null, equationOpPosition: null };
    }
    case 'SELECT_EQ_JOKER': {
      if (st.phase !== 'building') return st;
      return { ...st, equationOpCard: action.card, equationOpJokerOp: action.chosenOperation, equationOpPosition: null, jokerModalOpen: false, selectedCards: [] };
    }
    case 'PLACE_EQ_OP': {
      console.log('[REDUCER] PLACE_EQ_OP', 'pos=', action.position, 'hasCard=', !!st.equationOpCard);
      if (!st.equationOpCard || action.position < 0 || action.position > 2) return st;
      return { ...st, equationOpPosition: action.position };
    }
    case 'REMOVE_EQ_OP': {
      console.log('[REDUCER] REMOVE_EQ_OP');
      return { ...st, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null };
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
          selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
          activeOperation: null, activeFraction: null, consecutiveIdenticalPlays: 0,
          hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
          pendingFractionTarget: newTarget, fractionPenalty: denom,
          fractionAttackResolved: false, defenseSelectMode: false,
          lastMoveMessage: `⚔️ ${cp.name}: חסם בשבר ${action.card.fraction} — אתגר!`,
          message: `${cp.name} חסם/ה בשבר ${action.card.fraction}!`,
        };
      }

      // ── ATTACK MODE: fraction played offensively ──
      if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') return st;
      const newTarget = denom;
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], hasPlayedCards: true });
      if (ns.phase === 'game-over') return ns;
      const next = (ns.currentPlayerIndex + 1) % ns.players.length;
      return {
        ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
        currentPlayerIndex: next, phase: 'turn-transition', dice: null,
        selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
        activeOperation: null, activeFraction: null, consecutiveIdenticalPlays: 0,
        hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
        pendingFractionTarget: newTarget, fractionPenalty: denom,
        fractionAttackResolved: false,
        lastMoveMessage: `⚔️ ${cp.name}: הניח שבר ${action.card.fraction} — אתגר!`,
        message: `${cp.name} שיחק/ה שבר ${action.card.fraction}!`,
      };
    }
    case 'DEFEND_FRACTION_SOLVE': {
      if (st.pendingFractionTarget === null) return st;
      if (action.card.type !== 'number' || !action.card.value || action.card.value % st.fractionPenalty !== 0) return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: true, defenseSelectMode: false, lastCardValue: action.card.value ?? null, message: 'הגנה מוצלחת!' });
      if (ns.phase === 'game-over') return ns;
      return { ...ns, phase: 'pre-roll', hasPlayedCards: false };
    }
    case 'DEFEND_FRACTION_PENALTY': {
      if (st.pendingFractionTarget === null) return st;
      const cp = st.players[st.currentPlayerIndex];
      let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
      s = { ...s, pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: true, defenseSelectMode: false, lastMoveMessage: `📥 ${cp.name}: שלף ${st.fractionPenalty} קלפי עונשין`, message: `${cp.name} שלף/ה ${st.fractionPenalty} קלפי עונשין.` };
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
      const drawCp = st.players[st.currentPlayerIndex];
      let s = reshuffleDiscard(st);
      if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: '' };
      const drawnCard = s.drawPile[0];
      s = drawFromPile(s, 1, s.currentPlayerIndex);
      s = { ...s, hasDrawnCard: true, lastMoveMessage: `📥 ${drawCp.name}: שלף קלף מהחבילה` };
      return endTurnLogic(s);
    }
    case 'CALL_LOLOS': {
      const cp = st.players[st.currentPlayerIndex];
      if (cp.hand.length > 2) return st;
      return { ...st, players: st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, calledLolos: true } : p), message: `${cp.name} קרא/ה לולוס!` };
    }
    case 'END_TURN': return endTurnLogic(st);
    case 'SET_MESSAGE': return { ...st, message: action.message };
    case 'CLEAR_TOAST': return { ...st, lastMoveMessage: null };
    case 'SET_DEFENSE_SELECT_MODE': return { ...st, defenseSelectMode: action.enabled };
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
//  BUTTON — (old Btn removed, using LulosButton from components)
// ═══════════════════════════════════════════════════════════════

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
//  3D TEXT HELPERS
// ═══════════════════════════════════════════════════════════════

function interpolateColor(hex1: string, hex2: string, steps: number): string[] {
  const parse = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps <= 1 ? 0 : i / (steps - 1);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  });
}

function Text3D({ text, fontSize, faceColor, darkColor, lightColor, maxOffset = 10 }: {
  text: string; fontSize: number; faceColor: string; darkColor: string; lightColor: string; maxOffset?: number;
}) {
  const colors = interpolateColor(darkColor, lightColor, maxOffset);
  return (
    <View>
      {colors.map((color, i) => (
        <Text key={i} style={{
          position: 'absolute', top: maxOffset - i, left: maxOffset - i,
          color, fontSize, fontFamily: 'Fredoka_700Bold',
        }}>{text}</Text>
      ))}
      <Text style={{ color: faceColor, fontSize, fontFamily: 'Fredoka_700Bold' }}>{text}</Text>
    </View>
  );
}

function Line3D({ width, height, faceColor, darkColor, lightColor, layers = 3 }: {
  width: number; height: number; faceColor: string; darkColor: string; lightColor: string; layers?: number;
}) {
  const colors = interpolateColor(darkColor, lightColor, layers);
  return (
    <View style={{ width: width + layers, height: height + layers }}>
      {colors.map((color, i) => (
        <View key={i} style={{
          position: 'absolute', top: layers - i, left: layers - i,
          width, height, backgroundColor: color, borderRadius: height / 2,
        }} />
      ))}
      <View style={{ width, height, backgroundColor: faceColor, borderRadius: height / 2 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  JESTER SVG
// ═══════════════════════════════════════════════════════════════

function JesterSvg({ size = 45 }: { size?: number }) {
  const h = size * 1.4;
  return (
    <Svg width={size} height={h} viewBox="0 0 60 84">
      {/* Hat - 3 sharp triangles with bells */}
      <SvgPolygon points="30,28 8,4 25,26" fill="#EA4335" />
      <SvgPolygon points="30,28 30,0 35,26" fill="#4285F4" />
      <SvgPolygon points="30,28 52,4 35,26" fill="#34A853" />
      <SvgCircle cx={8} cy={4} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={30} cy={0} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={52} cy={4} r={3.5} fill="#FBBC05" />
      {/* Face */}
      <SvgCircle cx={30} cy={38} r={11} fill="#FFE0B2" />
      {/* Evil eyebrows */}
      <SvgPath d="M 23 34 L 28 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <SvgPath d="M 37 34 L 32 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      {/* Eyes */}
      <SvgCircle cx={26} cy={37} r={2} fill="#333" />
      <SvgCircle cx={34} cy={37} r={2} fill="#333" />
      {/* Wide mischievous grin */}
      <SvgPath d="M 23 43 Q 26 49 30 46 Q 34 49 37 43" stroke="#333" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {/* Scalloped yellow collar */}
      <SvgPath d="M 17 50 Q 21 46 25 50 Q 29 46 33 50 Q 37 46 41 50 L 41 53 L 17 53 Z" fill="#FBBC05" />
      {/* Split body — red left, green right */}
      <SvgRect x={19} y={53} width={11} height={16} fill="#EA4335" />
      <SvgRect x={30} y={53} width={11} height={16} fill="#34A853" />
      {/* Yellow diamonds */}
      <SvgPolygon points="25,58 27,55 29,58 27,61" fill="#FBBC05" />
      <SvgPolygon points="31,58 33,55 35,58 33,61" fill="#FBBC05" />
      <SvgPolygon points="25,65 27,62 29,65 27,68" fill="#FBBC05" />
      <SvgPolygon points="31,65 33,62 35,65 33,68" fill="#FBBC05" />
      {/* Legs — blue left, orange right */}
      <SvgRect x={20} y={69} width={9} height={11} rx={2} fill="#4285F4" />
      <SvgRect x={31} y={69} width={9} height={11} rx={2} fill="#F97316" />
      {/* Pointed shoes */}
      <SvgPath d="M 16 80 L 29 80 L 25 77" fill="#4285F4" />
      <SvgPath d="M 44 80 L 31 80 L 35 77" fill="#F97316" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BASE CARD — 3D white gradient, gloss sheen, colored border
// ═══════════════════════════════════════════════════════════════

function BaseCard({ children, borderColor = '#9CA3AF', selected = false, active = false, onPress, faceDown = false, small = false }: {
  children: React.ReactNode; borderColor?: string; selected?: boolean; active?: boolean; onPress?: () => void; faceDown?: boolean; small?: boolean;
}) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);

  // Face-down card (draw pile)
  if (faceDown) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[{ width: w, borderRadius: 12, borderBottomWidth: 6, borderBottomColor: '#1E1B4B' }, shadow3D('#000')]}>
        <LinearGradient colors={['#4338CA', '#312E81']} style={{ width: w, height: h, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(129,140,248,0.3)' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'rgba(165,180,252,0.5)' }} />
          <View style={{ position: 'absolute', top: 8, left: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(165,180,252,0.15)' }} />
          <View style={{ position: 'absolute', bottom: 8, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(165,180,252,0.15)' }} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  // Face-up card — white gradient + gloss sheen
  const bottomEdge = selected ? '#B45309' : (active ? '#15803D' : borderColor);
  const shadowStyle = active ? glowActive() : (selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10));

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: w, height: h, borderRadius: 12,
          borderBottomWidth: small ? 2 : 6, borderBottomColor: bottomEdge,
          transform: [{ translateY: selected ? (small ? -4 : -8) : (active ? -4 : 0) }],
        }, small
          ? Platform.select({ ios: { shadowColor: selected ? '#FACC15' : '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 }, android: { elevation: selected ? 6 : 3 } })
          : shadowStyle
        ]}>
          <View style={{
            width: w, height: h, borderRadius: 12, overflow: 'hidden',
            borderWidth: selected ? 3 : 2,
            borderColor: selected ? '#FACC15' : borderColor,
          }}>
            {/* White-to-gray gradient background (160deg) */}
            <LinearGradient
              colors={['#FFFFFF', '#F5F5F5', '#E8E8E8']}
              locations={[0, 0.7, 1]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* Gloss sheen overlay (radial ellipse approximation) */}
            <View style={{
              position: 'absolute', top: -(h * 0.15), left: w * 0.05,
              width: w * 0.9, height: h * 0.5, borderRadius: w,
              backgroundColor: 'rgba(255,255,255,0.45)',
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
//  CARD TYPE COMPONENTS — 3D text on white gradient cards
// ═══════════════════════════════════════════════════════════════

function getNumColors(v: number) {
  if (v <= 9) return { face: '#2196F3', border: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' };
  if (v <= 19) return { face: '#FBBC05', border: '#FBBC05', dark: '#8B6800', light: '#DC9E00' };
  return { face: '#34A853', border: '#34A853', dark: '#1B5E2B', light: '#36944F' };
}

function NumberCard({ card, selected, active, onPress, small }: { card: Card; selected?: boolean; active?: boolean; onPress?: () => void; small?: boolean }) {
  const v = card.value ?? 0;
  const cl = getNumColors(v);
  const fs = small ? 52 : 58;
  const maxOff = small ? 10 : 12;
  return (
    <BaseCard borderColor={cl.border} selected={selected} active={active} onPress={onPress} small={small}>
      <Text3D text={String(v)} fontSize={fs} faceColor={cl.face} darkColor={cl.dark} lightColor={cl.light} maxOffset={maxOff} />
    </BaseCard>
  );
}

const fracColors: Record<string, { face: string; dark: string; light: string }> = {
  '2': { face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' },
  '3': { face: '#34A853', dark: '#1B5E2B', light: '#36944F' },
  '4': { face: '#FBBC05', dark: '#8B6800', light: '#DC9E00' },
  '5': { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' },
};
const numRed = { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' };

function FractionCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const f = card.fraction ?? '1/2';
  const [num, den] = f.split('/');
  const denCl = fracColors[den] ?? numRed;
  const fs = small ? 36 : 42;
  const maxOff = small ? 6 : 8;
  const lineW = small ? 38 : 44;
  const lineH = small ? 5 : 6;
  return (
    <BaseCard borderColor={denCl.face} selected={selected} onPress={onPress} small={small}>
      <View style={{ alignItems: 'center' }}>
        <Text3D text={num} fontSize={fs} faceColor={numRed.face} darkColor={numRed.dark} lightColor={numRed.light} maxOffset={maxOff} />
        <View style={{ marginVertical: small ? 2 : 3 }}>
          <Line3D width={lineW} height={lineH} faceColor={denCl.face} darkColor={denCl.dark} lightColor={denCl.light} layers={3} />
        </View>
        <Text3D text={den} fontSize={fs} faceColor={denCl.face} darkColor={denCl.dark} lightColor={denCl.light} maxOffset={maxOff} />
      </View>
    </BaseCard>
  );
}

const opColors: Record<string, { face: string; dark: string; light: string }> = {
  '+': { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' },
  '/': { face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' },
  'x': { face: '#34A853', dark: '#1B5E2B', light: '#36944F' },
  '-': { face: '#FBBC05', dark: '#8B6800', light: '#DC9E00' },
};
const opDisplay: Record<string, string> = { 'x': '×', '-': '−', '/': '÷', '+': '+' };

function OperationCardComp({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const op = card.operation ?? '+';
  const cl = opColors[op] ?? opColors['+'];
  const display = opDisplay[op] ?? op;
  const fs = small ? 46 : 52;
  const maxOff = small ? 10 : 12;
  return (
    <BaseCard borderColor={cl.face} selected={selected} onPress={onPress} small={small}>
      <Text3D text={display} fontSize={fs} faceColor={cl.face} darkColor={cl.dark} lightColor={cl.light} maxOffset={maxOff} />
    </BaseCard>
  );
}

function JokerCard({ card: _c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const bw = 3;
  const maxOff = small ? 5 : 6;
  const cornerFs = small ? 15 : 18;
  const svgSize = small ? 50 : 60;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);

  const corners = [
    { sym: '+', face: '#EA4335', dark: '#8B1A12', light: '#DC4736', pos: { top: 3, left: 3 } as any, rot: '-12deg' },
    { sym: '÷', face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9', pos: { top: 3, right: 3 } as any, rot: '10deg' },
    { sym: '×', face: '#34A853', dark: '#1B5E2B', light: '#36944F', pos: { bottom: 10, left: 3 } as any, rot: '10deg' },
    { sym: '−', face: '#FBBC05', dark: '#8B6800', light: '#DC9E00', pos: { bottom: 10, right: 3 } as any, rot: '-10deg' },
  ];

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: w, height: h, borderRadius: 12,
          transform: [{ translateY: selected ? -8 : 0 }],
        }, selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10)]}>
          {/* Rainbow conic-gradient border (diagonal approximation) */}
          <LinearGradient
            colors={['#EA4335', '#4285F4', '#34A853', '#FBBC05', '#EA4335']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: w, height: h, borderRadius: 12, padding: bw }}
          >
            <View style={{ flex: 1, borderRadius: 12 - bw, overflow: 'hidden' }}>
              {/* White gradient fill */}
              <LinearGradient
                colors={['#FFFFFF', '#F5F5F5', '#E8E8E8']}
                locations={[0, 0.7, 1]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              {/* Gloss sheen */}
              <View style={{
                position: 'absolute', top: -(h * 0.15), left: w * 0.05,
                width: w * 0.9, height: h * 0.5, borderRadius: w,
                backgroundColor: 'rgba(255,255,255,0.4)',
              }} />
              {/* Jester SVG centered */}
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <JesterSvg size={svgSize} />
              </View>
              {/* 3D corner symbols — NO black outline */}
              {corners.map((c, i) => (
                <View key={i} style={[{ position: 'absolute', transform: [{ rotate: c.rot }] }, c.pos]}>
                  <Text3D text={c.sym} fontSize={cornerFs} faceColor={c.face} darkColor={c.dark} lightColor={c.light} maxOffset={maxOff} />
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
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
      <View style={{ width:96, height:132, alignItems:'center', justifyContent:'center' }}>
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

  // Detect spill: challenge card (fraction/operation) sitting on top
  const hasSpill = !!top && (
    (top.type === 'fraction' && state.pendingFractionTarget !== null) ||
    (top.type === 'operation' && state.activeOperation !== null)
  );
  const spillCard = hasSpill ? top : null;
  const visibleTop = hasSpill && pileSize > 1
    ? state.discardPile[pileSize - 2]
    : (hasSpill ? null : top);

  // Staged trap preview: operation card set as trap (position 2) but not yet placed
  const hasStagedTrap = !hasSpill && state.equationOpCard !== null && state.equationOpPosition === 2;
  const stagedTrapCard = hasStagedTrap ? state.equationOpCard : null;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Pulsing animation for staged trap preview
  const trapPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (hasStagedTrap) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(trapPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(trapPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else { trapPulse.setValue(0); }
  }, [hasStagedTrap]);

  useEffect(() => {
    if (hasSpill) {
      slideAnim.setValue(0);
      pulseAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1, tension: 50, friction: 8, useNativeDriver: true,
      }).start();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      slideAnim.setValue(0);
      pulseAnim.setValue(0);
    }
  }, [hasSpill]);

  // Fractions spill right, operations spill left
  const spillDir = spillCard?.type === 'operation' ? -1 : 1;

  return (
    <View style={{ alignItems:'center', gap:4 }}>
      <View style={{ width: hasSpill ? 140 : 96, height: hasSpill ? 148 : 132, alignItems:'center', justifyContent:'center' }}>
        {/* Pile layers — number card underneath stays visible */}
        {layers > 0 ? discardRotations.slice(3 - layers).map((r, i) => {
          const isTopLayer = i === layers - 1;
          return (
            <View key={i} style={{ position:'absolute', transform:[{rotate:r.rotate},{translateX:r.translateX},{translateY:r.translateY}] }}>
              {isTopLayer && visibleTop
                ? <GameCard card={visibleTop} active small />
                : <BaseCard faceDown small><></></BaseCard>}
            </View>
          );
        }) : <View style={dpS.empty}><Text style={{color:'#6B7280',fontSize:11}}>ריק</Text></View>}

        {/* Spill card — slides out half on / half off the pile */}
        {spillCard && (
          <Animated.View style={{
            position:'absolute', zIndex:10,
            transform: [
              { translateX: slideAnim.interpolate({
                inputRange: [0, 1], outputRange: [0, 44 * spillDir],
              }) },
              { translateY: slideAnim.interpolate({
                inputRange: [0, 1], outputRange: [0, -12],
              }) },
              { rotate: slideAnim.interpolate({
                inputRange: [0, 1], outputRange: ['0deg', `${12 * spillDir}deg`],
              }) as any },
            ],
          }}>
            {/* Pulsing red glow behind card */}
            <Animated.View style={{
              position:'absolute', top:-5, left:-5, right:-5, bottom:-5,
              borderRadius:16, backgroundColor:'rgba(231,76,60,0.25)',
              opacity: pulseAnim.interpolate({ inputRange:[0,1], outputRange:[0.3, 0.9] }),
            }} />
            <GameCard card={spillCard} small />
            {/* Challenge badge */}
            <View style={{ position:'absolute', bottom:-11, left:0, right:0, alignItems:'center' }}>
              <View style={{
                backgroundColor:'#E74C3C', paddingHorizontal:9, paddingVertical:3, borderRadius:6,
                ...Platform.select({
                  ios: { shadowColor:'#E74C3C', shadowOpacity:0.5, shadowRadius:6, shadowOffset:{width:0,height:2} },
                  android: { elevation:4 },
                }),
              }}>
                <Text style={{color:'#FFF',fontSize:9,fontWeight:'800'}}>⚔️ אתגר!</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Staged trap preview — pulsing border around operation card */}
        {stagedTrapCard && (
          <View style={{ position:'absolute', zIndex:10 }}>
            <Animated.View style={{
              position:'absolute', top:-4, left:-4, right:-4, bottom:-4,
              borderRadius:14, borderWidth:2.5,
              borderColor: stagedTrapCard.operation === '+' ? '#34A853' : stagedTrapCard.operation === '-' ? '#EA4335' : stagedTrapCard.operation === 'x' ? '#4285F4' : stagedTrapCard.operation === '÷' ? '#FBBC05' : '#EAB308',
              opacity: trapPulse.interpolate({ inputRange:[0,1], outputRange:[0.4, 1] }),
            }} />
            <GameCard card={stagedTrapCard} small />
            <View style={{ position:'absolute', bottom:-11, left:0, right:0, alignItems:'center' }}>
              <View style={{
                backgroundColor:'rgba(109,40,217,0.9)', paddingHorizontal:9, paddingVertical:3, borderRadius:6,
                ...Platform.select({
                  ios: { shadowColor:'#7C3AED', shadowOpacity:0.5, shadowRadius:6, shadowOffset:{width:0,height:2} },
                  android: { elevation:4 },
                }),
              }}>
                <Text style={{color:'#FFF',fontSize:9,fontWeight:'800'}}>⚔️ מלכודת</Text>
              </View>
            </View>
          </View>
        )}
      </View>
      <Text style={{color:'#9CA3AF',fontSize:11}}>ערימה</Text>
    </View>
  );
}
const dpS = StyleSheet.create({ empty: { width:80, height:115, borderRadius:12, borderWidth:2, borderStyle:'dashed', borderColor:'#4B5563', alignItems:'center', justifyContent:'center' } });

// ═══════════════════════════════════════════════════════════════
//  DICE AREA
// ═══════════════════════════════════════════════════════════════

function DiceArea() {
  const { state, dispatch } = useGame();
  const diceRef = useRef<DiceWebViewRef>(null);
  const canRoll = state.phase === 'pre-roll' && !state.hasPlayedCards && state.pendingFractionTarget === null && !state.activeOperation;

  const handleDiceResult = useCallback((results: number[], total: number) => {
    dispatch({ type: 'ROLL_DICE', values: { die1: results[0], die2: results[1], die3: results[2] } });
  }, [dispatch]);

  // After rolling: dice values appear only in the equation builder
  if (state.dice) return null;

  // Pre-roll: show 3D WebView dice
  return (
    <View style={{alignItems:'center',gap:8,alignSelf:'stretch',backgroundColor:'transparent'}}>
      <View style={{alignSelf:'stretch',height:200,backgroundColor:'transparent'}}>
        <DiceWebView
          ref={diceRef}
          onResult={handleDiceResult}
          height={200}
        />
      </View>
      {canRoll && (
        <View style={{alignSelf:'center', marginTop:12, marginBottom:8}}>
          <LulosButton
            text={state.roundsPlayed === 0 ? '🎲 בוא נשחק' : '🎲 לסיבוב הבא'}
            color="yellow"
            width={220}
            height={56}
            onPress={() => diceRef.current?.throwDice()}
          />
        </View>
      )}
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

const EQ_OPS: (string | null)[] = [null, '+', '-', '×', '÷'];

// Pip layouts for mini dice face (positions as fractions of container)
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
};

function DiceFaceMini({ value }: { value: number }) {
  const pips = PIP_LAYOUTS[value] || [];
  const SIZE = 40;
  const PIP_R = 4;
  return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: 8, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#F5D26B', '#E8B830', '#C48A18', '#9A6A0A']}
        start={{ x: 0.2, y: 0.15 }} end={{ x: 0.85, y: 0.9 }}
        style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' }}>
        {pips.map(([px, py], i) => (
          <View key={i} style={{
            position: 'absolute',
            left: px * SIZE - PIP_R,
            top: py * SIZE - PIP_R,
            width: PIP_R * 2,
            height: PIP_R * 2,
            borderRadius: PIP_R,
            backgroundColor: '#3a2208',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 1.5 },
              android: { elevation: 2 },
            }),
          }} />
        ))}
      </LinearGradient>
    </View>
  );
}

function EquationBuilder({ onConfirmChange }: { onConfirmChange?: (data: { onConfirm: () => void } | null) => void }) {
  const { state, dispatch } = useGame();

  // Dice placement: index into diceValues (0-2), or null — starts empty, player fills manually
  const [dice1, setDice1] = useState<number | null>(null);
  const [dice2, setDice2] = useState<number | null>(null);
  const [dice3, setDice3] = useState<number | null>(null);
  // Operators: null = empty, tap-to-cycle through EQ_OPS
  const [op1, setOp1] = useState<string | null>(null);
  const [op2, setOp2] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  // Result animation
  const resultFade = useRef(new Animated.Value(0)).current;

  // Drop-in animation: one Animated.Value per dice (0=hidden, 1=visible)
  const dropAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const eqRowAnim = useRef(new Animated.Value(0)).current;
  // Flip animation: 0=dice face visible, 1=number visible
  const flipAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [showingFace, setShowingFace] = useState([true, true, true]);

  // Reset on new dice roll + trigger staggered drop-in → pause → flip → equation
  const diceKey = state.dice ? `${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    // Clear any pending timers from previous roll
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setDice1(null); setDice2(null); setDice3(null);
    setOp1(null); setOp2(null);
    setResultsOpen(false);
    resultFade.setValue(0);
    if (diceKey) {
      // Reset all animations
      dropAnims.forEach(a => a.setValue(0));
      flipAnims.forEach(a => a.setValue(0));
      eqRowAnim.setValue(0);
      setShowingFace([true, true, true]);

      // Phase 1: Staggered drop-in (200ms between each)
      Animated.stagger(200,
        dropAnims.map(anim =>
          Animated.spring(anim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true })
        )
      ).start(() => {
        // Phase 2: Show dice faces for 1.5s, then staggered flip to numbers
        const FACE_HOLD = 1500;
        const FLIP_STAGGER = 100;
        const FLIP_SHRINK = 150;

        flipAnims.forEach((anim, i) => {
          const delay = FACE_HOLD + i * FLIP_STAGGER;
          // Swap face→number at midpoint of each flip
          timersRef.current.push(setTimeout(() => {
            setShowingFace(prev => { const n = [...prev]; n[i] = false; return n; });
          }, delay + FLIP_SHRINK));
          // Run the flip animation
          timersRef.current.push(setTimeout(() => {
            Animated.sequence([
              Animated.timing(anim, { toValue: 0.5, duration: FLIP_SHRINK, easing: Easing.in(Easing.ease), useNativeDriver: true }),
              Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
            ]).start();
          }, delay));
        });

        // Phase 3: Equation row slides in after all dice have flipped
        const totalFlipTime = FACE_HOLD + 2 * FLIP_STAGGER + FLIP_SHRINK + 200 + 50;
        timersRef.current.push(setTimeout(() => {
          Animated.spring(eqRowAnim, { toValue: 1, friction: 10, tension: 60, useNativeDriver: true }).start();
        }, totalFlipTime));
      });
    }
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, [diceKey]);

  const showBuilder = (state.phase === 'building' || state.phase === 'solved') && state.dice && !state.activeOperation && state.pendingFractionTarget === null;
  const isSolved = state.phase === 'solved';
  const diceValues = state.dice ? [state.dice.die1, state.dice.die2, state.dice.die3] : [0, 0, 0];

  // Which dice indices are placed
  const usedDice = new Set([dice1, dice2, dice3].filter(d => d !== null) as number[]);

  // Tap dice: place in next empty slot, or remove if already placed
  const hDice = (dIdx: number) => {
    if (isSolved) return;
    if (usedDice.has(dIdx)) {
      if (dice1 === dIdx) setDice1(null);
      else if (dice2 === dIdx) setDice2(null);
      else if (dice3 === dIdx) setDice3(null);
      return;
    }
    if (dice1 === null) setDice1(dIdx);
    else if (dice2 === null) setDice2(dIdx);
    else if (dice3 === null) setDice3(dIdx);
  };

  // Remove dice from a specific slot
  const removeDice = (slot: 1 | 2 | 3) => {
    if (isSolved) return;
    if (slot === 1) setDice1(null);
    else if (slot === 2) setDice2(null);
    else setDice3(null);
  };

  // Cycle operator on tap: null → + → − → × → ÷ → null
  const cycleOp = (which: 1 | 2) => {
    if (isSolved) return;
    const cur = which === 1 ? op1 : op2;
    const idx = EQ_OPS.indexOf(cur);
    const next = EQ_OPS[(idx + 1) % EQ_OPS.length];
    if (which === 1) setOp1(next);
    else setOp2(next);
  };

  // Reset all
  const resetAll = () => {
    if (isSolved) return;
    if (state.equationOpCard) dispatch({ type: 'REMOVE_EQ_OP' });
    setDice1(null); setDice2(null); setDice3(null);
    setOp1(null); setOp2(null);
    resultFade.setValue(0);
  };

  // ── Computation (L2R) with equation op card override ──
  const d1v = dice1 !== null ? diceValues[dice1] : null;
  const d2v = dice2 !== null ? diceValues[dice2] : null;
  const d3v = dice3 !== null ? diceValues[dice3] : null;

  // Effective operators: hand card overrides local cycle when placed in position 0 or 1
  const eqOpOperation = getEqOpCardOperation(state);
  const effectiveOp1 = (state.equationOpCard && state.equationOpPosition === 0 && eqOpOperation) ? eqOpOperation : op1;
  const effectiveOp2 = (state.equationOpCard && state.equationOpPosition === 1 && eqOpOperation) ? eqOpOperation : op2;

  // Sub-expression: (dice1 effectiveOp1 dice2)
  let subResult: number | null = null;
  if (d1v !== null && d2v !== null && effectiveOp1 !== null) {
    subResult = applyOperation(d1v, effectiveOp1, d2v);
  }

  // Final result: (subResult effectiveOp2 dice3), or just subResult for 2-dice
  let finalResult: number | null = null;
  if (subResult !== null) {
    if (d3v !== null && effectiveOp2 !== null) {
      finalResult = applyOperation(subResult, effectiveOp2, d3v);
    } else if (d3v === null && effectiveOp2 === null) {
      finalResult = subResult; // 2-dice equation
    }
  }
  if (finalResult !== null && (typeof finalResult !== 'number' || !Number.isFinite(finalResult))) finalResult = null;

  // Error states
  const hasError = (d1v !== null && d2v !== null && effectiveOp1 !== null && subResult === null) ||
    (subResult !== null && d3v !== null && effectiveOp2 !== null && finalResult === null);

  // Animate result appearance
  const prevResult = useRef<number | null>(null);
  useEffect(() => {
    if (finalResult !== null && prevResult.current !== finalResult) {
      resultFade.setValue(0.3);
      Animated.spring(resultFade, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    } else if (finalResult === null) {
      resultFade.setValue(0);
    }
    prevResult.current = finalResult;
  }, [finalResult]);

  // Validation
  const filledCount = [dice1, dice2, dice3].filter(d => d !== null).length;
  const ok = finalResult !== null && Number.isFinite(finalResult) && finalResult >= 0 && Number.isInteger(finalResult) && filledCount >= 2 && state.validTargets.some(t => t.result === finalResult);

  // Confirm handler
  const confirmRef = useRef<() => void>(() => {});
  const hConfirm = () => {
    if (!ok || finalResult === null || d1v === null || d2v === null || effectiveOp1 === null) return;
    let display: string;
    if (d3v !== null && effectiveOp2 !== null) {
      display = `(${d1v} ${effectiveOp1} ${d2v}) ${effectiveOp2} ${d3v} = ${finalResult}`;
    } else {
      display = `${d1v} ${effectiveOp1} ${d2v} = ${finalResult}`;
    }
    dispatch({ type: 'CONFIRM_EQUATION', result: finalResult, equationDisplay: display });
  };
  confirmRef.current = hConfirm;

  // Notify parent about confirm readiness
  const stableConfirm = useCallback(() => confirmRef.current(), []);
  useEffect(() => {
    if (onConfirmChange) {
      onConfirmChange(ok && !isSolved ? { onConfirm: stableConfirm } : null);
    }
  }, [ok, isSolved]);
  useEffect(() => () => onConfirmChange?.(null), []);

  if (!showBuilder) return null;

  // Whether 3rd dice slot / op2 are relevant (only when sub-expression is complete)
  const show3rd = subResult !== null;

  // ── Render helpers ──
  const renderDiceSlot = (slotValue: number | null, slotNum: 1 | 2 | 3) => (
    <TouchableOpacity
      style={[eqS.slot, slotValue !== null ? eqS.slotFilled : eqS.slotEmpty]}
      onPress={() => slotValue !== null && removeDice(slotNum)}
      activeOpacity={0.7} disabled={isSolved}>
      {slotValue !== null
        ? <Text style={eqS.slotVal}>{diceValues[slotValue]}</Text>
        : <Text style={eqS.slotPlaceholder}>?</Text>}
    </TouchableOpacity>
  );

  const renderOpBtn = (which: 1 | 2, currentOp: string | null, enabled: boolean) => {
    const posIdx = which - 1; // 0 or 1
    const isHandPlaced = state.equationOpCard !== null && state.equationOpPosition === posIdx;
    const isWaitingPlacement = state.equationOpCard !== null && state.equationOpPosition === null;
    const isJoker = state.equationOpCard?.type === 'joker';
    const handOp = eqOpOperation; // from getEqOpCardOperation
    const displayOp = isHandPlaced && handOp ? handOp : currentOp;

    const onPress = () => {
      if (isSolved || !enabled) return;
      if (isHandPlaced) {
        dispatch({ type: 'REMOVE_EQ_OP' });
        return;
      }
      if (isWaitingPlacement) {
        dispatch({ type: 'PLACE_EQ_OP', position: posIdx });
        return;
      }
      cycleOp(which);
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          eqS.opBtn,
          displayOp ? eqS.opBtnFilled : eqS.opBtnEmpty,
          !enabled && { opacity: 0.3 },
          isHandPlaced && !isJoker && { backgroundColor: '#D4A017', borderWidth: 2, borderColor: '#FFD700' },
          isHandPlaced && isJoker && { backgroundColor: '#7C3AED', borderWidth: 2, borderColor: '#A78BFA' },
          isWaitingPlacement && !isHandPlaced && { borderColor: '#A78BFA', borderWidth: 2, borderStyle: 'dashed' as any },
        ]}
        disabled={isSolved || !enabled}>
        <Text style={[
          displayOp ? eqS.opBtnFilledTxt : eqS.opBtnEmptyTxt,
          isHandPlaced && isJoker && { color: '#FFF' },
        ]}>
          {displayOp || '⬦'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[eqS.wrap, isSolved && { opacity: 0.5 }]}>
      {/* Dice pool */}
      {!isSolved && (
        <View style={eqS.diceRow}>
          {diceValues.map((dv, dIdx) => {
            const isUsed = usedDice.has(dIdx);
            const dropAnim = dropAnims[dIdx];
            const flipAnim = flipAnims[dIdx];
            const isFace = showingFace[dIdx];
            // Flip: scaleX goes 1→0→1 during flip
            const flipScaleX = flipAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0, 1],
            });
            return (
              <Animated.View key={dIdx} style={{
                opacity: dropAnim,
                transform: [
                  { translateY: dropAnim.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }) },
                  { scale: dropAnim.interpolate({ inputRange: [0, 0.5, 0.8, 1], outputRange: [1.8, 1.05, 0.9, 1] }) },
                  { scaleX: flipScaleX },
                ],
              }}>
                <TouchableOpacity onPress={() => hDice(dIdx)} activeOpacity={0.7}
                  style={[eqS.diceBtn, isFace && eqS.diceBtnFace, isUsed && eqS.diceBtnUsed]}
                  disabled={isFace}>
                  {isFace ? (
                    <DiceFaceMini value={dv} />
                  ) : (
                    <Text style={[eqS.diceBtnT, isUsed && eqS.diceBtnUsedT]}>{dv}</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* ═══ Single equation row: ( d1 OP1 d2 ) OP2 d3 = result ═══ */}
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', opacity: eqRowAnim, transform: [{ translateY: eqRowAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
        <View style={eqS.eqRow}>
          {/* Opening bracket */}
          <Text style={eqS.bracket}>(</Text>

          {renderDiceSlot(dice1, 1)}
          {renderOpBtn(1, op1, dice1 !== null)}
          {renderDiceSlot(dice2, 2)}

          {/* Closing bracket */}
          <Text style={eqS.bracket}>)</Text>

          {/* OP2 + dice3 (faded when sub-expression not complete) */}
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, !show3rd && { opacity: 0.25 }]}>
            {renderOpBtn(2, op2, show3rd)}
            {renderDiceSlot(dice3, 3)}
          </View>

          {/* = Result */}
          <Text style={eqS.eqEquals}>=</Text>
          <View style={[eqS.resultBox, hasError && {borderColor:'rgba(234,67,53,0.15)',backgroundColor:'rgba(234,67,53,0.05)'}]}>
            {hasError ? (
              <Text style={eqS.resultError}>✕</Text>
            ) : finalResult !== null && Number.isFinite(finalResult) ? (
              <Animated.View style={{ opacity: resultFade, transform: [{ scale: resultFade }] }}>
                <Text style={[eqS.resultVal, ok && { color: '#4ADE80' }]}>{finalResult}</Text>
              </Animated.View>
            ) : (
              <Text style={eqS.resultPlaceholder}>?</Text>
            )}
          </View>
        </View>
        {/* Reset button */}
        {!isSolved && (
          <TouchableOpacity onPress={resetAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: '#6B7280', fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Trailing trap button (position 2) */}
      {(() => {
        const trapColor = eqOpOperation === '+' ? '#34A853' : eqOpOperation === '-' ? '#EA4335' : eqOpOperation === 'x' ? '#4285F4' : eqOpOperation === '÷' ? '#FBBC05' : '#EAB308';
        const trapBg = eqOpOperation === '+' ? 'rgba(52,168,83,0.1)' : eqOpOperation === '-' ? 'rgba(234,67,53,0.1)' : eqOpOperation === 'x' ? 'rgba(66,133,244,0.1)' : eqOpOperation === '÷' ? 'rgba(251,188,5,0.1)' : 'rgba(234,179,8,0.1)';
        const trapBgSolid = eqOpOperation === '+' ? 'rgba(52,168,83,0.2)' : eqOpOperation === '-' ? 'rgba(234,67,53,0.2)' : eqOpOperation === 'x' ? 'rgba(66,133,244,0.2)' : eqOpOperation === '÷' ? 'rgba(251,188,5,0.2)' : 'rgba(234,179,8,0.2)';
        const trapText = eqOpOperation === '+' ? '#86EFAC' : eqOpOperation === '-' ? '#FCA5A5' : eqOpOperation === 'x' ? '#93C5FD' : eqOpOperation === '÷' ? '#FDE68A' : '#FDE68A';
        return (<>
          {!isSolved && state.equationOpCard && state.equationOpPosition === null && (
            <TouchableOpacity
              onPress={() => dispatch({ type: 'PLACE_EQ_OP', position: 2 })}
              activeOpacity={0.7}
              style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed' as any, borderColor: trapColor, backgroundColor: trapBg }}>
              <Text style={{ color: trapText, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>⚔️ הנח כמלכודת</Text>
            </TouchableOpacity>
          )}
          {!isSolved && state.equationOpCard && state.equationOpPosition === 2 && (
            <TouchableOpacity
              onPress={() => dispatch({ type: 'REMOVE_EQ_OP' })}
              activeOpacity={0.7}
              style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: trapColor, backgroundColor: trapBgSolid }}>
              <Text style={{ color: trapText, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>⚔️ מלכודת {eqOpOperation} — לחץ לביטול</Text>
            </TouchableOpacity>
          )}
        </>);
      })()}

      {/* Error message */}
      {hasError && (
        <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600', textAlign: 'center' }}>חלוקה לא חוקית</Text>
      )}

      {/* 2-dice hint */}
      {subResult !== null && dice3 === null && op2 === null && !isSolved && (
        <Text style={{ color: '#6B7280', fontSize: 10, textAlign: 'center', fontStyle: 'italic' }}>
          אפשר לסיים עם 2 קוביות בלבד
        </Text>
      )}

      {/* Solved phase instruction */}
      {isSolved && state.equationResult !== null && !state.hasPlayedCards && (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#4ADE80', fontSize: 15, fontWeight: '800', textAlign: 'center' }}>
            ✅ בחר קלפים שסכומם {state.equationResult}
          </Text>
        </View>
      )}

      {/* Possible results toggle */}
      {!isSolved && state.showPossibleResults && state.validTargets.length > 0 && (
        <View style={{ width: '100%', alignItems: 'flex-start' }}>
          <TouchableOpacity onPress={() => setResultsOpen(o => !o)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={eqS.hint}>{resultsOpen ? '▼' : '▶'} תוצאות אפשריות</Text>
          </TouchableOpacity>
          {resultsOpen && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 6, marginTop: 6 }}>
              {state.validTargets.map(t => {
                const v = t.result;
                const cp = state.players[state.currentPlayerIndex];
                const hasCard = cp?.hand.some(c => c.type === 'number' && c.value === v);
                const color = hasCard ? (v <= 9 ? '#4ADE80' : v <= 19 ? '#FACC15' : '#60A5FA') : '#6B7280';
                return <Text key={v} style={{ color, fontSize: 11, fontWeight: hasCard ? '700' : '400' }}>{v}</Text>;
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const eqS = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 14, alignItems: 'center', alignSelf: 'center' as any, width: '100%', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', },
  title: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  diceRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', direction: 'ltr' as any },
  diceBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,200,60,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,200,60,0.2)', overflow: 'hidden' },
  diceBtnFace: { backgroundColor: 'transparent', borderColor: 'rgba(232,184,48,0.4)', borderWidth: 2, padding: 0 },
  diceBtnUsed: { opacity: 0.25 },
  diceBtnT: { fontSize: 20, fontWeight: '800', color: '#e8d84a' },
  diceBtnUsedT: { color: 'rgba(255,200,60,0.3)' },
  // Single equation row with container
  eqRow: { flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 4, justifyContent: 'center', alignSelf: 'center' as any, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bracket: { fontSize: 36, fontWeight: '300', color: 'rgba(255,200,60,0.35)', marginHorizontal: 1 },
  // Dice slots (compact 44×44)
  slot: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  slotFilled: { backgroundColor: '#FFF', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  slotEmpty: { borderWidth: 2, borderStyle: 'dashed' as any, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.02)' },
  slotVal: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  slotPlaceholder: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.15)' },
  // Operator button (compact 34×34, tap-to-cycle)
  opBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  opBtnEmpty: { borderWidth: 2, borderStyle: 'dashed' as any, borderColor: '#F9A825', backgroundColor: 'transparent' },
  opBtnFilled: { backgroundColor: '#F9A825', ...Platform.select({ ios: { shadowColor: 'rgba(249,168,37,0.3)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 }, android: { elevation: 4 } }) },
  opBtnEmptyTxt: { fontSize: 14, fontWeight: '800', color: '#F9A825' },
  opBtnFilledTxt: { fontSize: 18, fontWeight: '800', color: '#1a1510' },
  // = sign and result box
  eqEquals: { fontSize: 22, fontWeight: '800', color: '#FFD700', marginHorizontal: 2 },
  resultBox: { minWidth: 40, height: 44, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)', backgroundColor: 'rgba(255,215,0,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  resultVal: { fontSize: 24, fontWeight: '800', color: '#FFD700' },
  resultPlaceholder: { fontSize: 24, fontWeight: '800', color: 'rgba(255,215,0,0.25)' },
  resultError: { fontSize: 18, fontWeight: '900', color: '#EA4335' },
  hint: { color: '#6B7280', fontSize: 11, textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════
//  STAGING ZONE
// ═══════════════════════════════════════════════════════════════

function StagingZone() {
  const { state, dispatch } = useGame();
  if (state.phase !== 'solved' || state.equationResult === null || state.hasPlayedCards || state.pendingFractionTarget !== null) return null;

  const target = state.equationResult;
  const staged = state.stagedCards;
  const numberCards = staged.filter(c => c.type === 'number');
  const sum = numberCards.reduce((s, c) => s + (c.value ?? 0), 0);
  const hasCards = staged.length > 0;
  const matches = hasCards && sum === target;

  const clearAll = () => { staged.forEach(c => dispatch({type:'UNSTAGE_CARD',card:c})); };

  return (
    <View style={szS.wrap}>
      {hasCards && (
        <View style={{alignItems:'center',gap:6}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,direction:'ltr' as any}}>
            <Text style={{color:'#9CA3AF',fontSize:13,fontWeight:'600'}}>נבחר:</Text>
            {numberCards.map((c, i) => (
              <React.Fragment key={c.id}>
                {i > 0 && <Text style={{color:'#FDD835',fontSize:16,fontWeight:'900'}}>+</Text>}
                <Text style={{color:'#FFF',fontSize:16,fontWeight:'900'}}>{c.value}</Text>
              </React.Fragment>
            ))}
            <Text style={{color:'#FFD700',fontSize:16,fontWeight:'900'}}>=</Text>
            <Text style={{color: matches ? '#4ADE80' : '#FCA5A5',fontSize:18,fontWeight:'900'}}>{sum}</Text>
            {matches && <Text style={{color:'#4ADE80',fontSize:16}}>✓</Text>}
            <TouchableOpacity onPress={clearAll} hitSlop={{top:8,bottom:8,left:8,right:8}} style={szS.undoBtn}>
              <Text style={{color:'#FCA5A5',fontSize:18,fontWeight:'900'}}>↩</Text>
            </TouchableOpacity>
          </View>
          {!matches && sum !== target && (
            <Text style={{color:'#FCA5A5',fontSize:12,textAlign:'center'}}>הסכום לא תואם! צריך {target}, נבחר {sum}</Text>
          )}
        </View>
      )}
      {!hasCards && <Text style={szS.hint}>לחץ/י על קלפי מספר מהיד למטה</Text>}
    </View>
  );
}
const szS = StyleSheet.create({
  wrap:{backgroundColor:'transparent',borderRadius:0,padding:12,alignItems:'center',gap:8,borderWidth:0,borderColor:'transparent'},
  hint:{color:'#6B7280',fontSize:12,textAlign:'center'},
  undoBtn:{marginLeft:4,width:32,height:32,borderRadius:16,backgroundColor:'rgba(239,68,68,0.2)',alignItems:'center',justifyContent:'center'},
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
  const canLol=(pr||bl||so)&&cp.hand.length<=2&&!cp.calledLolos&&!opCh&&!hasFracDefense;
  return (
    <View style={{width:'100%',gap:10}}>
      {opCh && !hasFracDefense && <View style={aS.opS}><Text style={aS.opT}>אתגר פעולה: {state.activeOperation}</Text><Text style={aS.opH}>הגן/י עם קלף פעולה תואם או ג'וקר.</Text><LulosButton text="קבל/י עונש" color="red" width={160} height={48} onPress={()=>dispatch({type:'END_TURN'})} /></View>}
      {/* Skip/Draw button moved to pile area */}
      {(pr||bl||so)&&hp&&!hasFracDefense && <View style={{flexDirection:'row',gap:8}}><LulosButton text="סיים תור" color="green" width={160} height={52} onPress={()=>dispatch({type:'END_TURN'})} /></View>}
      {canLol && <View style={{flexDirection:'row',gap:8}}><LulosButton text="לולוס!" color="yellow" width={180} height={64} fontSize={26} onPress={()=>dispatch({type:'CALL_LOLOS'})} /></View>}
      <AppModal visible={state.jokerModalOpen} onClose={()=>dispatch({type:'CLOSE_JOKER_MODAL'})} title="בחר/י פעולה לג'וקר">
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center'}}>
          {(['+','-','x','÷'] as Operation[]).map(op => <LulosButton key={op} text={op} color="blue" width={100} height={64} fontSize={30} onPress={()=>{const j=state.selectedCards[0];if(!j)return;if(state.phase==='building'){dispatch({type:'SELECT_EQ_JOKER',card:j,chosenOperation:op});}else{dispatch({type:'PLAY_JOKER',card:j,chosenOperation:op});}}} />)}
        </View>
      </AppModal>
    </View>
  );
}
const aS = StyleSheet.create({ opS:{backgroundColor:'transparent',borderWidth:0,borderColor:'transparent',borderRadius:0,padding:12}, opT:{color:'#FDBA74',fontSize:13,fontWeight:'600',marginBottom:4}, opH:{color:'#9CA3AF',fontSize:11,marginBottom:8} });

// ═══════════════════════════════════════════════════════════════
//  CARD FAN — carousel/wheel with swipe + tap-to-select
//  Fan pivot below visible cards, center card enlarged with glow
// ═══════════════════════════════════════════════════════════════

const FAN_CARD_W = 100;
const FAN_CARD_H = 140;
const FAN_MAX_ANGLE = 30;
const FAN_CENTER_SCALE = 1.15;
const FAN_EDGE_SCALE = 0.82;
const FAN_DECEL = 0.92;
const FAN_MIN_SPACING = 0.4;
const FAN_MAX_SPACING = 1.6;
const FAN_DEFAULT_SPACING = 1.0;
const PINCH_CARD_THRESHOLD = 8;

function SimpleHand({ cards, stagedCardIds, identicalCardIds, equationOpCardId, equationOpPlaced, defenseValidCardIds, onTap, onCenterCard }: {
  cards: Card[];
  stagedCardIds: Set<string>;
  identicalCardIds: Set<string>;
  equationOpCardId: string | null;
  equationOpPlaced: boolean;
  defenseValidCardIds: Set<string> | null;
  onTap: (card: Card) => void;
  onCenterCard?: (card: Card | null) => void;
}) {
  const count = cards.length;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(0);

  // Pulsing glow for identical cards
  const identPulse = useRef(new Animated.Value(0)).current;
  const hasIdent = identicalCardIds.size > 0;
  useEffect(() => {
    if (hasIdent) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(identPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(identPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else { identPulse.setValue(0); }
  }, [hasIdent]);

  // Center card glow pulse — slow gentle breathing
  const centerGlowPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(centerGlowPulse, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(centerGlowPulse, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const dragStartVal = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const maxIdxRef = useRef(0);
  maxIdxRef.current = Math.max(0, count - 1);

  // Pinch-to-space state
  const [spacing, setSpacing] = useState(FAN_DEFAULT_SPACING);
  const spacingRef = useRef(FAN_DEFAULT_SPACING);
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartSpacing = useRef(FAN_DEFAULT_SPACING);

  const [centerIdx, setCenterIdx] = useState(0);
  const lastCenterIdx = useRef(-1);
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      scrollRef.current = value;
      const idx = Math.round(Math.max(0, Math.min(cards.length - 1, value)));
      if (idx !== lastCenterIdx.current) {
        lastCenterIdx.current = idx;
        setCenterIdx(idx);
        onCenterCard?.(cards[idx] ?? null);
      }
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, cards, onCenterCard]);

  useEffect(() => { scrollX.setValue(0); scrollRef.current = 0; lastCenterIdx.current = 0; setCenterIdx(0); onCenterCard?.(cards[0] ?? null); }, [count]);

  // Use refs for functions so PanResponder always sees latest
  const snapRef = useRef(() => {});
  const momentumRef = useRef(() => {});

  snapRef.current = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const target = Math.round(Math.max(0, Math.min(maxIdxRef.current, scrollRef.current)));
    Animated.spring(scrollX, { toValue: target, useNativeDriver: true, friction: 7, tension: 50 }).start();
  };

  momentumRef.current = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      velocityRef.current *= FAN_DECEL;
      if (Math.abs(velocityRef.current) < 0.005) { snapRef.current(); return; }
      let next = scrollRef.current + velocityRef.current;
      const mx = maxIdxRef.current;
      if (next < 0) { next *= 0.4; velocityRef.current *= 0.6; }
      else if (next > mx) { next = mx + (next - mx) * 0.4; velocityRef.current *= 0.6; }
      scrollX.setValue(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) return true;
        return Math.abs(gs.dx) > 10;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) return true;
        return Math.abs(gs.dx) > 10;
      },
      onPanResponderGrant: () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        scrollX.stopAnimation();
        dragStartVal.current = scrollRef.current;
        velocityRef.current = 0;
        isPinching.current = false;
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;

        // ── Pinch mode (2 fingers, 8+ cards) ──
        if (touches.length >= 2 && maxIdxRef.current >= PINCH_CARD_THRESHOLD - 1) {
          const tdx = touches[0].pageX - touches[1].pageX;
          const tdy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(tdx * tdx + tdy * tdy);

          if (!isPinching.current) {
            isPinching.current = true;
            pinchStartDist.current = dist;
            pinchStartSpacing.current = spacingRef.current;
          } else {
            const scale = dist / pinchStartDist.current;
            const next = Math.max(FAN_MIN_SPACING, Math.min(FAN_MAX_SPACING, pinchStartSpacing.current * scale));
            spacingRef.current = next;
            setSpacing(next);
          }
          return; // Don't scroll while pinching
        }

        // ── Single finger scroll (FIXED: drag right = cards scroll right) ──
        if (isPinching.current) return;
        const cardsDragged = gs.dx / (FAN_CARD_W * 0.8);
        let next = dragStartVal.current + cardsDragged;
        const mx = maxIdxRef.current;
        if (next < 0) next = next * 0.3;
        else if (next > mx) next = mx + (next - mx) * 0.3;
        scrollX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        if (isPinching.current) { isPinching.current = false; snapRef.current(); return; }
        velocityRef.current = gs.vx * 0.25;
        if (Math.abs(velocityRef.current) > 0.02) momentumRef.current();
        else snapRef.current();
      },
      onPanResponderTerminate: () => { isPinching.current = false; snapRef.current(); },
    })
  ).current;

  if (count === 0) return <View style={{ height: 200 }} />;

  const fanH = FAN_CARD_H * FAN_CENTER_SCALE + 55;
  const sp = spacing; // pinch multiplier for translateX + angles

  return (
    <View style={{ width: SCREEN_W, height: fanH, overflow: 'visible' }} {...panResponder.panHandlers}>
      {cards.map((card, i) => {
        const isStaged = stagedCardIds.has(card.id);
        const isIdent = identicalCardIds.has(card.id);
        const isEqOp = equationOpCardId === card.id;
        const isDefenseValid = defenseValidCardIds !== null && defenseValidCardIds.has(card.id);
        const isDefenseInvalid = defenseValidCardIds !== null && !defenseValidCardIds.has(card.id);

        // All interpolations from scrollX directly. When scrollX===i, card i is center.
        const ir = [i - 5, i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3, i + 5];

        const maxA = FAN_MAX_ANGLE * sp;
        const rotateStr = scrollX.interpolate({
          inputRange: ir,
          outputRange: [
            `${-maxA}deg`, `${-maxA}deg`,
            `${-maxA * 0.75}deg`, `${-maxA * 0.35}deg`,
            '0deg',
            `${maxA * 0.35}deg`, `${maxA * 0.75}deg`,
            `${maxA}deg`, `${maxA}deg`,
          ],
        });

        const scale = scrollX.interpolate({
          inputRange: [i - 3, i - 1, i, i + 1, i + 3],
          outputRange: [FAN_EDGE_SCALE, FAN_EDGE_SCALE + 0.04, FAN_CENTER_SCALE, FAN_EDGE_SCALE + 0.04, FAN_EDGE_SCALE],
          extrapolate: 'clamp',
        });

        const translateX = scrollX.interpolate({
          inputRange: ir,
          outputRange: [-240*sp, -175*sp, -120*sp, -62*sp, 0, 62*sp, 120*sp, 175*sp, 240*sp],
        });

        const arcY = scrollX.interpolate({
          inputRange: [i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3],
          outputRange: [50, 28, 10, 0, 10, 28, 50],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange: [i - 4, i - 3, i, i + 3, i + 4],
          outputRange: [0.2, 0.55, 1, 0.55, 0.2],
          extrapolate: 'clamp',
        });

        const glowOpacity = scrollX.interpolate({
          inputRange: [i - 0.8, i - 0.25, i, i + 0.25, i + 0.8],
          outputRange: [0, 0, 1, 0, 0],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={card.id}
            style={{
              position: 'absolute',
              left: SCREEN_W / 2 - FAN_CARD_W / 2,
              top: isEqOp && !equationOpPlaced ? -10 : isStaged ? -5 : 20,
              width: FAN_CARD_W,
              height: FAN_CARD_H,
              transform: [
                { translateX },
                { translateY: arcY },
                { rotate: rotateStr },
                { scale },
              ],
              opacity,
              zIndex: count - Math.abs(i - centerIdx),
            }}
          >
            {/* Sphera glow — tight golden border ring with focused bloom */}
            <Animated.View style={{
              position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
              borderRadius: 15,
              borderWidth: 2.5, borderColor: 'rgba(255,190,50,0.9)',
              backgroundColor: 'transparent',
              opacity: Animated.multiply(glowOpacity, centerGlowPulse.interpolate({ inputRange:[0,1], outputRange:[0.7,1.0] })),
              ...Platform.select({
                ios: { shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8 },
                android: { elevation: 8 },
              }),
            }} />
            {/* Pulsing glow behind identical cards */}
            {isIdent && !isStaged && (
              <Animated.View style={{
                position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
                borderRadius: 18, backgroundColor: 'rgba(245,158,11,0.35)',
                opacity: identPulse.interpolate({ inputRange:[0,1], outputRange:[0.3,0.9] }),
                ...Platform.select({
                  ios: { shadowColor: '#F59E0B', shadowOffset:{width:0,height:0}, shadowOpacity: 0.8, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }} />
            )}
            {/* Purple glow behind selected equation op card */}
            {isEqOp && !equationOpPlaced && (
              <View style={{
                position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
                borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.35)',
                borderWidth: 2, borderColor: '#A78BFA',
                ...Platform.select({
                  ios: { shadowColor: '#7C3AED', shadowOffset:{width:0,height:0}, shadowOpacity: 0.8, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }} />
            )}
            {/* Green glow behind valid defense cards */}
            {isDefenseValid && (
              <View style={{
                position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
                borderRadius: 18, backgroundColor: 'rgba(52,168,83,0.35)',
                borderWidth: 2, borderColor: '#34A853',
                ...Platform.select({
                  ios: { shadowColor: '#34A853', shadowOffset:{width:0,height:0}, shadowOpacity: 0.8, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }} />
            )}
            <TouchableOpacity activeOpacity={0.8} onPress={() => onTap(card)} disabled={isDefenseInvalid}>
              <View style={[
                isIdent && { borderWidth: 2, borderColor: '#F59E0B', borderRadius: 12 },
                isStaged && { borderWidth: 3, borderColor: '#FFD700', borderRadius: 12 },
                isEqOp && !equationOpPlaced && { borderWidth: 2, borderColor: '#A78BFA', borderRadius: 12 },
                isDefenseValid && { borderWidth: 2, borderColor: '#34A853', borderRadius: 12 },
              ]}>
                <GameCard card={card} selected={isStaged} small onPress={isDefenseInvalid ? undefined : () => onTap(card)} />
              </View>
            </TouchableOpacity>
            {/* Dim overlay for invalid defense cards */}
            {isDefenseInvalid && (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)',
              }} pointerEvents="none" />
            )}
            {/* Dim overlay for placed equation op card */}
            {isEqOp && equationOpPlaced && (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)',
              }} pointerEvents="none" />
            )}
            {isIdent && !isStaged && (
              <Animated.View style={{
                position: 'absolute', top: -6, left: -6,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: '#F59E0B',
                alignItems: 'center', justifyContent: 'center', zIndex: 10,
                opacity: identPulse.interpolate({ inputRange:[0,1], outputRange:[0.7,1] }),
                ...Platform.select({ ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 }, android: { elevation: 8 } }),
              }}>
                <Text style={{ fontSize: 12 }}>🔄</Text>
              </Animated.View>
            )}
            {isStaged && (
              <View style={{
                position: 'absolute', top: -6, right: -6,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: '#FFD700',
                alignItems: 'center', justifyContent: 'center', zIndex: 10,
                ...Platform.select({ ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 }, android: { elevation: 8 } }),
              }}>
                <Text style={{ color: '#3D2800', fontSize: 13, fontWeight: '900' }}>✓</Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STRATEGY HINT TOOLTIP
// ═══════════════════════════════════════════════════════════════

function StrategyHintTooltip({ operation, isJoker }: { operation: Operation | null; isJoker: boolean }) {
  const [visible, setVisible] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  let message: string;
  if (isJoker) {
    message = 'שים את הג׳וקר בסוף התרגיל — הוא יהפוך לכל סימן שתבחר והשחקן הבא יהיה חייב להשתמש בו!';
  } else {
    switch (operation) {
      case '+': message = 'שים את הפלוס בסוף התרגיל — השחקן הבא יהיה חייב להשתמש בו!'; break;
      case '-': message = 'שים את המינוס בסוף התרגיל — השחקן הבא יהיה חייב להשתמש בו!'; break;
      case 'x': message = 'שים את הכפל בסוף התרגיל — השחקן הבא יהיה חייב להשתמש בו!'; break;
      case '÷': message = 'שים את החילוק בסוף התרגיל — השחקן הבא יהיה חייב להשתמש בו!'; break;
      default: message = 'שים את הפעולה בסוף התרגיל — השחקן הבא יהיה חייב להשתמש בה!';
    }
  }

  return (
    <Animated.View style={{
      alignItems: 'center', paddingHorizontal: 16,
      opacity: slideAnim,
      transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
    }}>
      <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.8}>
        <LinearGradient colors={['#7C3AED', '#5B21B6']} style={{
          paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
          borderWidth: 3, borderColor: '#A78BFA',
          ...Platform.select({
            ios: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
            android: { elevation: 10 },
          }),
        }}>
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 18 }}>
            💡 {message}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  const [centerCard, setCenterCard] = useState<Card | null>(null);
  const showFractionHint = (pr || bl || so) && !state.hasPlayedCards && !hasFracDefense && centerCard?.type === 'fraction';
  const fractionHintFloat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showFractionHint) {
      fractionHintFloat.setValue(0);
      Animated.loop(Animated.sequence([
        Animated.timing(fractionHintFloat, { toValue: -6, duration: 1200, useNativeDriver: true }),
        Animated.timing(fractionHintFloat, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])).start();
    } else {
      fractionHintFloat.stopAnimation();
      fractionHintFloat.setValue(0);
    }
  }, [showFractionHint]);

  const tap = (card:Card) => {
    console.log('CARD TAP', card.id, card.type, card.type==='operation'?card.operation:'', 'phase=', state.phase, 'hp=', state.hasPlayedCards, 'activeOp=', state.activeOperation);
    if (state.hasPlayedCards) { console.log('BLOCKED: hasPlayedCards'); return; }

    // ── Fraction defense: ONLY solve (number) or block (fraction) allowed ──
    if (hasFracDefense) {
      if (card.type === 'number' && card.value && card.value % state.fractionPenalty === 0) {
        dispatch({ type: 'DEFEND_FRACTION_SOLVE', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      return;
    }

    if (pr) {
      if (card.type === 'fraction') { dispatch({ type: 'PLAY_FRACTION', card }); return; }
      if (opCh) { if(card.type==='operation'&&card.operation===state.activeOperation) dispatch({type:'PLAY_OPERATION',card}); else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card}); return; }
      if (state.consecutiveIdenticalPlays < 2 && validateIdenticalPlay(card,td)) dispatch({type:'PLAY_IDENTICAL',card}); return;
    }
    if (bl) {
      if (card.type === 'operation') {
        if (state.equationOpCard?.id === card.id) {
          dispatch({ type: 'REMOVE_EQ_OP' });
        } else if (!state.equationOpCard || state.equationOpPosition === null) {
          dispatch({ type: 'SELECT_EQ_OP', card });
        }
      }
      else if (card.type === 'fraction') dispatch({ type: 'PLAY_FRACTION', card });
      else if (card.type === 'joker') dispatch({ type: 'OPEN_JOKER_MODAL', card });
      return;
    }
    if (so) {
      // Solved phase: number + operation → stage/unstage, fraction, joker
      if(card.type==='number' || card.type==='operation') {
        const isStaged = state.stagedCards.some(c => c.id === card.id);
        if (isStaged) dispatch({type:'UNSTAGE_CARD',card});
        else dispatch({type:'STAGE_CARD',card});
      }
      else if(card.type==='fraction') dispatch({type:'PLAY_FRACTION',card});
      else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card});
    }
  };

  const stagedIds = new Set(state.stagedCards.map(c => c.id));
  const identicalIds = new Set<string>(
    pr && !state.hasPlayedCards && state.consecutiveIdenticalPlays < 2 && td
      ? sorted.filter(card => validateIdenticalPlay(card, td)).map(c => c.id)
      : []
  );

  // Defense selection mode: compute valid card IDs
  const defenseValidIds = state.defenseSelectMode && hasFracDefense
    ? new Set<string>(sorted.filter(c =>
        (c.type === 'number' && c.value && c.value % state.fractionPenalty === 0) || c.type === 'fraction'
      ).map(c => c.id))
    : null;

  const showOpHint = bl && state.equationOpCard !== null && state.equationOpPosition === null;
  const hintOp = state.equationOpCard?.type === 'joker' ? null : state.equationOpCard?.operation ?? null;
  const hintIsJoker = state.equationOpCard?.type === 'joker';

  return (
    <View style={{width:'100%',overflow:'visible'}} pointerEvents="box-none">
      {showOpHint && <StrategyHintTooltip key={state.equationOpCard!.id} operation={hintOp} isJoker={hintIsJoker} />}
      <SimpleHand cards={sorted} stagedCardIds={stagedIds} identicalCardIds={identicalIds} equationOpCardId={state.equationOpCard?.id ?? null} equationOpPlaced={state.equationOpPosition !== null} defenseValidCardIds={defenseValidIds} onTap={tap} onCenterCard={setCenterCard} />
      {/* Fraction hint — tappable button to place fraction on pile */}
      {showFractionHint && centerCard && (
        <Animated.View style={{position:'absolute',bottom:-4,left:0,right:0,alignItems:'center',transform:[{translateY:fractionHintFloat}],zIndex:150}}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => dispatch({ type: 'PLAY_FRACTION', card: centerCard })}>
            <View style={{
              backgroundColor:'rgba(109,40,217,0.85)', borderRadius:12,
              paddingHorizontal:16, paddingVertical:8,
              borderWidth: 1.5, borderColor: '#A78BFA',
              ...Platform.select({
                ios: { shadowColor:'#7C3AED', shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:8 },
                android: { elevation: 8 },
              }),
            }}>
              <Text style={{color:'#FFF',fontSize:12,fontWeight:'700',textAlign:'center'}}>💡 טיפ: הנח את השבר על הערימה כדי לאתגר את השחקן הבא!</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const bcBtnBase = {
  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' as const, justifyContent: 'center' as const,
  borderWidth: 1.5,
} as const;
const bcShadow = Platform.select({
  ios: { shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 6 },
  android: { elevation: 6 },
}) as any;

function BottomControlsBar() {
  const { state, dispatch } = useGame();
  const pr = state.phase === 'pre-roll';
  const so = state.phase === 'solved';
  const showSolved = so && !state.hasPlayedCards;
  const target = showSolved ? state.equationResult : null;
  const stagedSum = showSolved ? state.stagedCards.filter(c=>c.type==='number').reduce((s,c)=>s+(c.value??0),0) : 0;
  const sumMatches = target !== null && stagedSum === target && state.stagedCards.length > 0;
  const hasStaged = showSolved && state.stagedCards.length > 0;

  // Identical card detection
  const cp = state.players[state.currentPlayerIndex];
  const td = state.discardPile[state.discardPile.length - 1];
  const hasIdentical = pr && !state.hasPlayedCards && state.consecutiveIdenticalPlays < 2 && cp && td
    && cp.hand.some(c => validateIdenticalPlay(c, td));

  const showBar = showSolved || hasIdentical;

  return (
    <View style={{height:40,alignItems:'center',justifyContent:'center',paddingHorizontal:10,backgroundColor: showBar ? 'rgba(15,23,42,0.95)' : 'transparent', borderTopWidth: showBar ? 1 : 0, borderTopColor:'rgba(255,255,255,0.08)'}}>
      {showSolved ? (
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,width:'100%'}}>
          {/* Target badge */}
          <View style={{...bcBtnBase,backgroundColor:'#6D28D9',borderColor:'rgba(167,139,250,0.5)',flex:1,...bcShadow,shadowColor:'#6D28D9'}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:4,justifyContent:'center'}}>
              <Text style={{color:'#E9D5FF',fontSize:11,fontWeight:'700'}}>יעד</Text>
              <Text style={{color:'#FFF',fontSize:16,fontWeight:'900'}}>{target}</Text>
              {hasStaged && <Text style={{color: sumMatches ? '#4ADE80' : '#FCA5A5',fontSize:12,fontWeight:'800'}}>({stagedSum})</Text>}
            </View>
          </View>
          {/* Confirm button */}
          {hasStaged && (
            <TouchableOpacity onPress={()=>dispatch({type:'CONFIRM_STAGED'})} activeOpacity={0.7}
              style={{...bcBtnBase,backgroundColor:'#16A34A',borderColor:'rgba(134,239,172,0.5)',flex:1.2,...bcShadow,shadowColor:'#16A34A'}}>
              <Text style={{color:'#FFF',fontSize:14,fontWeight:'800',textAlign:'center'}}>הנח קלפים</Text>
            </TouchableOpacity>
          )}
          {/* Revert button */}
          <TouchableOpacity onPress={()=>dispatch({type:'REVERT_TO_BUILDING'})} activeOpacity={0.7}
            style={{...bcBtnBase,backgroundColor:'rgba(251,146,60,0.12)',borderColor:'#FB923C',borderWidth:2,flex:1,...bcShadow,shadowColor:'#FB923C'}}>
            <Text style={{color:'#FFF',fontSize:12,fontWeight:'700',textAlign:'center'}}>חזרה לתרגיל</Text>
          </TouchableOpacity>
        </View>
      ) : hasIdentical ? (
        <View style={{
          flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
          backgroundColor:'#16A34A', borderRadius:12, paddingHorizontal:16, paddingVertical:10,
          width: SCREEN_W - 40, borderWidth:1.5, borderColor:'rgba(134,239,172,0.5)',
          ...Platform.select({
            ios: { shadowColor:'#16A34A', shadowOffset:{width:0,height:3}, shadowOpacity:0.45, shadowRadius:6 },
            android: { elevation:6 },
          }),
        }}>
          <Text style={{color:'#FFF',fontSize:14,fontWeight:'800',textAlign:'center'}}>🔄 קלף זהה - לחץ עליו לדילוג</Text>
        </View>
      ) : null}
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════
//  START SCREEN
// ═══════════════════════════════════════════════════════════════

// Floating background math symbols data
const FLOAT_SYMS = [
  // Operators
  { sym: '+', left: '8%', startY: 0.1, size: 28, speed: 1.0, drift: 12, opacity: 0.04 },
  { sym: '−', left: '25%', startY: 0.5, size: 22, speed: 1.2, drift: -8, opacity: 0.04 },
  { sym: '×', left: '50%', startY: 0.2, size: 32, speed: 0.8, drift: 15, opacity: 0.04 },
  { sym: '÷', left: '75%', startY: 0.7, size: 24, speed: 1.1, drift: -10, opacity: 0.04 },
  { sym: '+', left: '18%', startY: 0.8, size: 20, speed: 1.3, drift: 6, opacity: 0.04 },
  { sym: '−', left: '60%', startY: 0.35, size: 26, speed: 0.9, drift: -14, opacity: 0.04 },
  { sym: '×', left: '40%', startY: 0.65, size: 30, speed: 1.0, drift: 10, opacity: 0.04 },
  { sym: '÷', left: '88%', startY: 0.45, size: 22, speed: 1.15, drift: -6, opacity: 0.04 },
  // Fractions (doubles the density)
  { sym: '½', left: '12%', startY: 0.25, size: 26, speed: 0.9, drift: -11, opacity: 0.06 },
  { sym: '¾', left: '68%', startY: 0.1, size: 24, speed: 1.05, drift: 8, opacity: 0.06 },
  { sym: '⅓', left: '33%', startY: 0.55, size: 28, speed: 0.85, drift: -13, opacity: 0.06 },
  { sym: '⅔', left: '80%', startY: 0.3, size: 22, speed: 1.25, drift: 7, opacity: 0.06 },
  { sym: '¼', left: '4%', startY: 0.7, size: 30, speed: 0.75, drift: -9, opacity: 0.06 },
  { sym: '⅛', left: '45%', startY: 0.85, size: 20, speed: 1.35, drift: 12, opacity: 0.06 },
  { sym: '⅝', left: '93%', startY: 0.4, size: 24, speed: 1.1, drift: -7, opacity: 0.06 },
  { sym: '⅕', left: '55%', startY: 0.75, size: 26, speed: 0.95, drift: 14, opacity: 0.06 },
];

function FloatingMathBackground() {
  const floatAnims = useRef(FLOAT_SYMS.map(() => new Animated.Value(0))).current;
  const swayAnims = useRef(FLOAT_SYMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    FLOAT_SYMS.forEach((s, i) => {
      const startPos = SCREEN_H * s.startY;
      floatAnims[i].setValue(startPos);
      const fullDur = (10000 + i * 1200) / s.speed;
      const firstDur = fullDur * ((startPos + 80) / (SCREEN_H + 80));

      // Vertical rise
      Animated.timing(floatAnims[i], {
        toValue: -80, duration: firstDur, useNativeDriver: true,
      }).start(() => {
        floatAnims[i].setValue(SCREEN_H);
        Animated.loop(
          Animated.timing(floatAnims[i], { toValue: -80, duration: fullDur, useNativeDriver: true })
        ).start();
      });

      // Horizontal sway
      Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnims[i], { toValue: s.drift, duration: 2500 + i * 300, useNativeDriver: true }),
          Animated.timing(swayAnims[i], { toValue: -s.drift, duration: 2500 + i * 300, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FLOAT_SYMS.map((s, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute', left: s.left as any,
            fontSize: s.size, fontWeight: '900',
            color: `rgba(255,255,255,${s.opacity})`,
            transform: [
              { translateY: floatAnims[i] },
              { translateX: swayAnims[i] },
            ],
          }}
        >
          {s.sym}
        </Animated.Text>
      ))}
    </View>
  );
}

function ConditionalFloatingBg() {
  const { state } = useGame();
  if (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') return null;
  return <FloatingMathBackground />;
}

function StartScreen() {
  const { dispatch } = useGame();
  const safe = useGameSafeArea();
  const [playerCount, setPlayerCount] = useState(2);
  const [numberRange, setNumberRange] = useState<'easy' | 'full'>('full');
  const [fractions, setFractions] = useState(true);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [timer, setTimer] = useState<'30' | '45' | 'off'>('off');
  const [devOpen, setDevOpen] = useState(false);

  // Joker bounce animation
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Joker gentle bounce (4s loop, 6px)
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 2000, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startGame = () => {
    const players = Array.from({ length: playerCount }, (_, i) => ({ name: `שחקן ${i + 1}` }));
    dispatch({ type: 'START_GAME', players, difficulty: numberRange, fractions, showPossibleResults });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Joker — sticky at top, lowered for Dynamic Island */}
      <View style={hsS.jokerFixed}>
        <Animated.View style={{
          transform: [{ translateY: bounceAnim }],
          width: 115, height: 115,
          borderRadius: 18, overflow: 'hidden',
          borderWidth: 2, borderColor: 'rgba(255,215,0,0.12)',
          backgroundColor: 'rgba(255,215,0,0.04)',
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 32 },
            android: { elevation: 10 },
          }),
        }}>
          <Image source={require('./assets/joker.jpg')} style={{ width: 115, height: 115 }} resizeMode="contain" />
        </Animated.View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Settings */}
        <View style={hsS.settings}>
          {/* Player count */}
          <View style={hsS.row}>
            <Text style={hsS.rowLabel}>מספר שחקנים</Text>
            <View style={hsS.stepper}>
              <TouchableOpacity
                onPress={() => setPlayerCount(c => Math.max(2, c - 1))}
                disabled={playerCount <= 2} activeOpacity={0.7}
                style={[hsS.stepBtnWrap, playerCount <= 2 && { opacity: 0.3 }]}
              >
                <LinearGradient colors={['#FFE87C','#F9A825','#E8930C','#C67A08']} locations={[0,0.4,0.8,1]} style={hsS.stepBtn}>
                  <View style={hsS.stepBtnInner} />
                  <Text style={hsS.stepBtnTxt}>−</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={hsS.stepVal}>{playerCount}</Text>
              <TouchableOpacity
                onPress={() => setPlayerCount(c => Math.min(6, c + 1))}
                disabled={playerCount >= 6} activeOpacity={0.7}
                style={[hsS.stepBtnWrap, playerCount >= 6 && { opacity: 0.3 }]}
              >
                <LinearGradient colors={['#FFE87C','#F9A825','#E8930C','#C67A08']} locations={[0,0.4,0.8,1]} style={hsS.stepBtn}>
                  <View style={hsS.stepBtnInner} />
                  <Text style={hsS.stepBtnTxt}>+</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Number range */}
          <View style={hsS.row}>
            <Text style={hsS.rowLabel}>טווח מספרים</Text>
            <View style={hsS.toggleGroup}>
              {([['easy', '0-12'], ['full', '0-25']] as const).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setNumberRange(key)} activeOpacity={0.7}
                  style={[hsS.toggleBtn, numberRange === key ? hsS.toggleOn : hsS.toggleOff]}>
                  <Text style={numberRange === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Fractions */}
          <View style={hsS.row}>
            <Text style={hsS.rowLabel}>שברים</Text>
            <View style={hsS.toggleGroup}>
              {([[false, 'בלי שברים'], [true, 'עם שברים']] as const).map(([key, label]) => (
                <TouchableOpacity key={String(key)} onPress={() => setFractions(key as boolean)} activeOpacity={0.7}
                  style={[hsS.toggleBtn, fractions === key ? hsS.toggleOn : hsS.toggleOff]}>
                  <Text style={fractions === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Possible results */}
          <View style={hsS.row}>
            <Text style={hsS.rowLabel}>תוצאות אפשריות</Text>
            <View style={hsS.toggleGroup}>
              {([[false, 'הסתר'], [true, 'הצג']] as const).map(([key, label]) => (
                <TouchableOpacity key={String(key)} onPress={() => setShowPossibleResults(key as boolean)} activeOpacity={0.7}
                  style={[hsS.toggleBtn, showPossibleResults === key ? hsS.toggleOn : hsS.toggleOff]}>
                  <Text style={showPossibleResults === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Timer */}
          <View style={hsS.row}>
            <Text style={hsS.rowLabel}>טיימר</Text>
            <View style={hsS.toggleGroup}>
              {([['45', '45 שנ׳'], ['30', '30 שנ׳'], ['off', 'כבוי']] as const).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setTimer(key)} activeOpacity={0.7}
                  style={[hsS.toggleBtn, timer === key ? hsS.toggleOn : hsS.toggleOff]}>
                  <Text style={timer === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Start button — green canvas, in scroll */}
        <View style={{ marginTop: 16 }}>
          <LulosButton text="התחל משחק" color="green" width={SCREEN_W - 40} height={54} fontSize={19} onPress={startGame} />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, textAlign: 'center', marginTop: 8, width: '100%' }}>v1.0.0</Text>
      </ScrollView>

      {/* Dev button — fixed bottom-left */}
      <TouchableOpacity onPress={() => setDevOpen(true)} style={{ position: 'absolute', bottom: safe.SAFE_BOTTOM_PAD, left: 12, opacity: 0.3, padding: 4, zIndex: 20 }}>
        <Text style={{ fontSize: 16 }}>⚙️</Text>
      </TouchableOpacity>

      {/* Dev settings modal (placeholder) */}
      <AppModal visible={devOpen} onClose={() => setDevOpen(false)} title="הגדרות מפתח">
        <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>בקרוב...</Text>
      </AppModal>
    </View>
  );
}
const hsS = StyleSheet.create({
  // Joker fixed at top — lowered for Dynamic Island
  jokerFixed: {
    alignItems: 'center', paddingTop: 54, paddingBottom: 8, zIndex: 10,
  },
  // Settings container
  settings: { width: '100%', marginTop: 8 },
  // Setting row — horizontal, label left, controls right
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600', flexShrink: 0 },
  // Toggle group
  toggleGroup: { flexDirection: 'row', gap: 5 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  toggleOn: {
    backgroundColor: '#FFD700', borderColor: 'rgba(255,215,0,0.4)',
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.08)' },
  toggleOnTxt: { fontSize: 12, fontWeight: '700', color: '#3D2800' },
  toggleOffTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  // Card-style stepper +/- buttons (operation card design)
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtnWrap: {
    borderRadius: 10,
    ...Platform.select({
      ios: { shadowColor: '#6B5210', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.7, shadowRadius: 6 },
      android: { elevation: 8 },
    }),
  },
  stepBtn: {
    width: 42, height: 58, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(160,120,10,0.45)',
    overflow: 'hidden',
  },
  stepBtnInner: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  stepBtnTxt: {
    fontSize: 28, fontWeight: '700', color: '#5a3800',
    textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  stepVal: {
    fontSize: 26, fontWeight: '700', color: '#FFF', minWidth: 28, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
});

// ═══════════════════════════════════════════════════════════════
//  TURN TRANSITION
// ═══════════════════════════════════════════════════════════════

function TurnTransition() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  return (
    <View style={{flex:1}}>
      {/* Exit button */}
      <View style={{position:'absolute',top:54,right:20,zIndex:10}}><LulosButton text="יציאה" color="red" width={100} height={44} onPress={()=>dispatch({type:'RESET_GAME'})} /></View>

      {/* Center content */}
      <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:32}}>
        <Text style={{color:'#9CA3AF',fontSize:14}}>העבר/י את המכשיר ל</Text>
        <Text style={{color:'#FFF',fontSize:32,fontWeight:'800',marginTop:8}}>{cp?.name}</Text>
        <Text style={{color:'#6B7280',fontSize:12,marginTop:8}}>{cp?.hand.length} קלפים ביד</Text>
        {!!state.message && <View style={{backgroundColor:'rgba(234,179,8,0.1)',borderRadius:10,padding:12,marginTop:16,width:'100%'}}><Text style={{color:'#FDE68A',fontSize:13,textAlign:'center'}}>{state.message}</Text></View>}
      </View>

      {/* Bottom zone — pinned to bottom, matching Zone J style */}
      <View style={{backgroundColor:'rgba(0,0,0,0.15)',borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)',paddingHorizontal:16,paddingVertical:14,paddingBottom:24,alignItems:'center'}}>
        <LulosButton text="אני מוכן/ה" color="yellow" width={280} height={64} onPress={()=>dispatch({type:'BEGIN_TURN'})} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAME SCREEN
// ═══════════════════════════════════════════════════════════════

function PlayerSidebar() {
  const { state } = useGame();
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <>
      <View style={sbS.wrap}>
        {state.players.map((p, i) => (
          <View key={p.id} style={[sbS.badge, i === state.currentPlayerIndex && sbS.badgeActive]}>
            <Text style={[sbS.badgeName, i === state.currentPlayerIndex && sbS.badgeNameActive]} numberOfLines={1}>{p.name}</Text>
            <Text style={[sbS.badgeCount, i === state.currentPlayerIndex && sbS.badgeCountActive]}>{p.hand.length}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={() => setRulesOpen(true)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Text style={{fontSize:16}}>📖</Text>
      </TouchableOpacity>
      <AppModal visible={rulesOpen} onClose={() => setRulesOpen(false)} title="איך משחקים לולוס">
        <ScrollView style={{maxHeight:400}}>
          <Text style={{fontSize:14,fontWeight:'800',color:'#FFD700',marginBottom:8,textAlign:'right'}}>בסיסי</Text>
          {[
            '🃏 כל שחקן מקבל 10 קלפים. הראשון שמרוקן את היד — מנצח!',
            '🎯 הטל 3 קוביות ובנה תרגיל חשבון (אפשר להשתמש ב-2 קוביות בלבד)',
            '🃏 בחר קלפים מהיד שסכומם שווה לתוצאת התרגיל',
            '🔄 קלף זהה: אפשר להניח קלף זהה לערימה ולדלג על הקוביות. מוגבל לפעמיים ברצף!',
            '🃏 ג\'וקר — מגן מכל התקפה ומאתגר את השחקן הבא',
          ].map((r, i) => (
            <Text key={`b${i}`} style={{color:'rgba(255,255,255,0.7)',fontSize:13,lineHeight:20,marginBottom:6,textAlign:'right'}}>{r}</Text>
          ))}
          <Text style={{fontSize:14,fontWeight:'800',color:'#FFD700',marginTop:16,marginBottom:8,textAlign:'right'}}>התקפות</Text>
          {[
            '⚔️ שבר (½, ⅓, ¼, ⅕) = התקפה! מחלק את הקלף העליון ומכריח את היריב להגן',
            '🛡️ הגנה: הנח קלף מספר שמתחלק במכנה השבר, או חסום עם שבר נוסף',
            '💀 אין הגנה? שלוף קלפי עונשין כמספר המכנה של השבר',
            '➕ קלפי פעולה (+, −, ×, ÷): מכריחים את השחקן הבא להגן עם קלף פעולה תואם או ג\'וקר',
          ].map((r, i) => (
            <Text key={`a${i}`} style={{color:'rgba(255,255,255,0.7)',fontSize:13,lineHeight:20,marginBottom:6,textAlign:'right'}}>{r}</Text>
          ))}
          <Text style={{fontSize:14,fontWeight:'800',color:'#FFD700',marginTop:16,marginBottom:8,textAlign:'right'}}>מיוחד</Text>
          {[
            '0️⃣ חוק הסימנים: שים את המינוס בסוף לאתגר את היריב! לדוגמה: 4 4 -',
            '⚡ שלישייה בקוביות: כל שאר השחקנים שולפים קלפים כמספר הקובייה!',
          ].map((r, i) => (
            <Text key={`s${i}`} style={{color:'rgba(255,255,255,0.7)',fontSize:13,lineHeight:20,marginBottom:6,textAlign:'right'}}>{r}</Text>
          ))}
        </ScrollView>
      </AppModal>
    </>
  );
}
const sbS = StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:4,flex:1},
  badge:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(255,255,255,0.1)',paddingHorizontal:8,paddingVertical:3,borderRadius:6},
  badgeActive:{backgroundColor:'#2196F3'},
  badgeName:{color:'rgba(255,255,255,0.4)',fontSize:10,fontWeight:'700',maxWidth:60},
  badgeNameActive:{color:'#FFF'},
  badgeCount:{color:'rgba(255,255,255,0.3)',fontSize:10,fontWeight:'700'},
  badgeCountActive:{color:'#E3F2FD'},
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION TOAST — simple auto-dismissing messages
// ═══════════════════════════════════════════════════════════════
const TOAST_H = 44;
const FAN_H_TOTAL = FAN_CARD_H * FAN_CENTER_SCALE + 55; // card fan visual height

function NotificationToast() {
  const { state, dispatch } = useGame();
  const safe = useGameSafeArea();
  const [text, setText] = useState<string | null>(null);
  const prevMsg = useRef<string | null>(null);
  const prevToast = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current; // 0=hidden, 1=visible

  const show = (msg: string, duration: number = 3500) => {
    setText(msg);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(slideAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setText(null);
      });
    }, duration);
  };
  const showRef = useRef(show); showRef.current = show;

  // Toast messages (lastMoveMessage)
  useEffect(() => {
    if (state.lastMoveMessage && state.lastMoveMessage !== prevToast.current) {
      prevToast.current = state.lastMoveMessage;
      showRef.current(state.lastMoveMessage, 4000);
      // Clear state after display
      setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 4200);
    }
    if (!state.lastMoveMessage) prevToast.current = null;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state.lastMoveMessage]);

  // Plain messages (not during challenges)
  useEffect(() => {
    if (state.message && state.pendingFractionTarget === null && !state.identicalAlert && state.message !== prevMsg.current) {
      prevMsg.current = state.message;
      showRef.current(state.message, 3000);
      setTimeout(() => dispatch({ type: 'SET_MESSAGE', message: '' }), 3200);
    }
    if (!state.message) prevMsg.current = null;
  }, [state.message, state.pendingFractionTarget, state.identicalAlert]);

  if (!text) return null;

  const color = text.startsWith('✅') ? '#4ADE80'
    : (text.startsWith('⚔️') || text.startsWith('⚠️')) ? '#FDBA74' : '#FFF';

  return (
    <Animated.View style={{
      position: 'absolute', bottom: safe.SAFE_BOTTOM_PAD + FAN_H_TOTAL + 8, left: 20, right: 20,
      minHeight: TOAST_H, zIndex: 150,
      backgroundColor: 'rgba(0,0,0,0.82)',
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      opacity: slideAnim,
      transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }} pointerEvents="none">
      <Text style={{ color, fontSize: 13, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{text}</Text>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CHALLENGE CURTAIN — peeking card + expandable drawer
// ═══════════════════════════════════════════════════════════════
const CURTAIN_PEEK_H = 68;
const CURTAIN_EXPANDED_H = SCREEN_H * 0.5;

function ChallengeCurtain() {
  const { state, dispatch } = useGame();
  const safe = useGameSafeArea();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const drawerH = useRef(new Animated.Value(CURTAIN_PEEK_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const prevChallengeRef = useRef<string | null>(null);

  const hasFraction = state.pendingFractionTarget !== null;
  const hasIdentical = !!state.identicalAlert;
  const hasChallenge = hasFraction || hasIdentical;

  // Challenge key for auto-expand detection
  const challengeKey = hasFraction ? `frac-${state.fractionPenalty}` : hasIdentical ? `ident-${state.identicalAlert!.playerName}` : null;

  const doExpand = useCallback(() => {
    setExpanded(true);
    expandedRef.current = true;
    Animated.spring(drawerH, { toValue: CURTAIN_EXPANDED_H, tension: 65, friction: 10, useNativeDriver: false }).start();
    Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const doCollapse = useCallback(() => {
    expandedRef.current = false;
    Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(drawerH, { toValue: CURTAIN_PEEK_H, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() => setExpanded(false));
  }, []);

  const expandFn = useRef(doExpand); expandFn.current = doExpand;
  const collapseFn = useRef(doCollapse); collapseFn.current = doCollapse;

  // Auto-expand on new challenge, auto-collapse when cleared
  useEffect(() => {
    if (hasChallenge && challengeKey !== prevChallengeRef.current) {
      prevChallengeRef.current = challengeKey;
      setTimeout(() => expandFn.current(), 100);
    }
    if (!hasChallenge) {
      prevChallengeRef.current = null;
      if (expandedRef.current) collapseFn.current();
      else drawerH.setValue(CURTAIN_PEEK_H);
    }
  }, [hasChallenge, challengeKey]);

  // PanResponder for swipe
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 15,
    onPanResponderRelease: (_, gs) => {
      if (gs.dy < -20 && !expandedRef.current) expandFn.current();
      else if (gs.dy > 20 && expandedRef.current) collapseFn.current();
    },
  })).current;

  if (!hasChallenge) return null;
  // Hide curtain when defense selection mode is active (reminder bar replaces it)
  if (state.defenseSelectMode && !expanded) return null;

  // Theme colors
  const isFraction = hasFraction;
  const peekGradient: [string, string] = isFraction ? ['#F97316', '#EA580C'] : ['#EF4444', '#DC2626'];
  const peekText = isFraction ? '⚠️ אתגר שבר!' : '🃏 קלף זהה!';
  const peekBottom = safe.CURTAIN_PEEK_BOTTOM;

  return (
    <>
      {/* Backdrop overlay */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 350,
          opacity: backdropOpacity,
        }}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={doCollapse} />
      </Animated.View>

      {/* Curtain drawer */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[{
          position: 'absolute',
          bottom: expanded ? 0 : peekBottom,
          left: expanded ? 0 : 24,
          right: expanded ? 0 : 24,
          zIndex: expanded ? 400 : 300,
          borderTopLeftRadius: expanded ? 24 : 16,
          borderTopRightRadius: expanded ? 24 : 16,
          borderBottomLeftRadius: expanded ? 0 : 16,
          borderBottomRightRadius: expanded ? 0 : 16,
          overflow: 'hidden',
          ...(Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.3, shadowRadius: 10 },
            android: { elevation: 20 },
          }) ?? {}),
        }, { height: drawerH }]}
      >
        <LinearGradient
          colors={expanded ? ['#1E293B', '#0F172A'] : peekGradient}
          style={{ flex: 1 }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: expanded ? 12 : 10, paddingBottom: expanded ? 8 : 6 }}>
            <View style={{
              width: expanded ? 48 : 36, height: expanded ? 5 : 4,
              borderRadius: 3, backgroundColor: expanded ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)',
            }} />
          </View>

          {!expanded ? (
            /* Collapsed: peeking card tab */
            <TouchableOpacity onPress={doExpand} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 12, paddingHorizontal: 12 }}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                {peekText}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 3 }}>הקש להרחבה ▲</Text>
            </TouchableOpacity>
          ) : (
            /* Expanded: full challenge drawer */
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 24 + safe.safeBottom }}
              showsVerticalScrollIndicator={false}
            >
              {hasFraction && (
                <>
                  <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4 }}>⚠️ אותגרת!</Text>
                  <Text style={{ color: '#FDE68A', fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 24 }}>
                    {state.fractionPenalty === 2 ? 'הנח קלף מספר זוגי (מתחלק ב-2) או קלף שבר' : `הנח קלף שמתחלק ב-${state.fractionPenalty} או קלף שבר`}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { dispatch({ type: 'SET_DEFENSE_SELECT_MODE', enabled: true }); doCollapse(); }}
                    style={{ backgroundColor: '#34A853', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#34A853', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6 }, android: { elevation: 6 } }) }}
                  >
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>🃏 הנח קלפים מהיד</Text>
                  </TouchableOpacity>
                  <View style={{ backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', width: '100%' }}>
                    <Text style={{ color: '#FDBA74', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>עונש: שליפת {state.fractionPenalty} קלפים</Text>
                  </View>
                  <LulosButton text={`שלוף ${state.fractionPenalty} קלפי עונשין`} color="red" width={260} height={52} onPress={() => { dispatch({ type: 'DEFEND_FRACTION_PENALTY' }); doCollapse(); }} style={{ marginTop: 4 }} />
                </>
              )}
              {hasIdentical && !hasFraction && (
                <>
                  <Text style={{ fontSize: 48, marginTop: 4 }}>🔄</Text>
                  <Text style={{ color: '#E74C3C', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>קלף זהה!</Text>
                  <Text style={{ color: '#FCA5A5', fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 26 }}>
                    {state.identicalAlert!.playerName} הניח קלף זהה ({state.identicalAlert!.cardDisplay}) — דילוג על קוביות!
                  </Text>
                  {state.identicalAlert!.consecutive === 1 && (
                    <View style={{ backgroundColor: 'rgba(253,186,116,0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(253,186,116,0.2)', width: '100%' }}>
                      <Text style={{ color: '#FDBA74', fontSize: 14, textAlign: 'center' }}>נותר עוד שימוש אחד בקלף זהה</Text>
                    </View>
                  )}
                  {(state.identicalAlert!.consecutive ?? 0) >= 2 && (
                    <View style={{ backgroundColor: 'rgba(231,76,60,0.15)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(231,76,60,0.3)', width: '100%' }}>
                      <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '800', textAlign: 'center' }}>⚠️ זה השימוש האחרון! השחקן הבא חייב להטיל קוביות</Text>
                    </View>
                  )}
                  <LulosButton text="הבנתי!" color="red" width={180} height={52} onPress={() => { dispatch({ type: 'DISMISS_IDENTICAL_ALERT' }); doCollapse(); }} style={{ marginTop: 4 }} />
                </>
              )}
            </ScrollView>
          )}
        </LinearGradient>
      </Animated.View>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DEFENSE REMINDER BAR — shown when picking cards for defense
// ═══════════════════════════════════════════════════════════════
function DefenseReminderBar() {
  const { state, dispatch } = useGame();
  const safe = useGameSafeArea();
  if (!state.defenseSelectMode || state.pendingFractionTarget === null) return null;
  return (
    <View style={{
      position: 'absolute', bottom: safe.OVERLAY_BOTTOM,
      left: 16, right: 16, zIndex: 300,
      backgroundColor: 'rgba(249,115,22,0.92)', borderRadius: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 10,
      ...Platform.select({
        ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6 },
        android: { elevation: 8 },
      }),
    }}>
      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1 }}>⚠️ בחר קלף להגנה</Text>
      <TouchableOpacity onPress={() => dispatch({ type: 'SET_DEFENSE_SELECT_MODE', enabled: false })} activeOpacity={0.7}
        style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>ביטול</Text>
      </TouchableOpacity>
    </View>
  );
}

function GameScreen() {
  const { state, dispatch } = useGame();
  const safe = useGameSafeArea();
  const cp = state.players[state.currentPlayerIndex];
  const [showCel,setShowCel] = useState(false);
  const [eqConfirm, setEqConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const prevJ = useRef(state.jokerModalOpen);
  useEffect(() => { if(prevJ.current&&!state.jokerModalOpen&&state.hasPlayedCards) setShowCel(true); prevJ.current=state.jokerModalOpen; }, [state.jokerModalOpen,state.hasPlayedCards]);
  return (
    <LinearGradient colors={['#0F172A','#1E293B']} style={{flex:1,paddingTop:50}}>

      {/* ── Zone A: Header (player badges + rules + exit) ── */}
      <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingBottom:6,gap:8}}>
        <PlayerSidebar />
        <LulosButton text="יציאה" color="red" width={70} height={32} fontSize={11} onPress={()=>dispatch({type:'RESET_GAME'})} />
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView scrollEnabled={false} style={{flex:1}} contentContainerStyle={{padding:12,gap:14,paddingBottom:400}} showsVerticalScrollIndicator={false}>
        {/* ── Dice + Deck side by side (RTL: first child = right) ── */}
        <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
          <View style={{alignItems:'center',gap:4}}>
            <DiscardPile />
            <Text style={{color:'#6B7280',fontSize:10}}>{state.drawPile.length} בחבילה</Text>
          </View>
          <View style={{flex:1,alignItems:'center'}}><DiceArea /></View>
        </View>

        {/* Staging */}
        <StagingZone />
      </ScrollView>

      {/* ── Bottom Stack: Equation + Card Fan + Controls ── */}
      <View style={{position:'absolute',bottom:0,left:0,right:0,overflow:'visible'}} pointerEvents="box-none">

        {/* Equation Builder — overflow hidden to clip dice drop animation */}
        <View style={{paddingHorizontal:12,zIndex:90,overflow:'hidden'}} pointerEvents="box-none">
          <EquationBuilder onConfirmChange={setEqConfirm} />
        </View>

        {/* Zone I: Card Fan */}
        <View style={{overflow:'visible',zIndex:100}} pointerEvents="box-none">
          <PlayerHand />
        </View>

        {/* Zone F: Actions + Bottom Controls */}
        <View style={{zIndex:200,paddingBottom:safe.SAFE_BOTTOM_PAD}} pointerEvents="box-none">
          <View style={{alignItems:'center',gap:2,paddingHorizontal:20,paddingVertical:2}} pointerEvents="box-none">
            {(state.phase==='building'||state.phase==='solved')&&!state.hasPlayedCards&&state.pendingFractionTarget===null && (
              <View pointerEvents="auto">
                <LulosButton text={'\u200Fשלוף קלף (ויתור)'} color="red" height={36} fontSize={13} onPress={()=>dispatch({type:'DRAW_CARD'})} />
              </View>
            )}
            {state.phase === 'building' && eqConfirm && (
              <View pointerEvents="auto">
                <LulosButton text="▶ בחר קלפים" color="green" width={200} height={36} onPress={eqConfirm.onConfirm} />
              </View>
            )}
            {(state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards && state.equationOpCard && state.equationOpPosition === 2 && (
              <View pointerEvents="auto">
                <LulosButton text="הנח קלפים והמשך ▶" color="green" width={220} height={42} fontSize={15} onPress={()=>dispatch({type:'CONFIRM_TRAP_ONLY'})} />
              </View>
            )}
            <View pointerEvents="auto"><ActionBar /></View>
          </View>
          <BottomControlsBar />
        </View>

      </View>

      {showCel && <CelebrationFlash onDone={()=>setShowCel(false)} />}
      {/* ── Notification Layer: all overlays use useGameSafeArea() ── */}
      <NotificationToast />
      <ChallengeCurtain />
      <DefenseReminderBar />
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
    <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:32}}>
      <Confetti />
      <Text style={{fontSize:56,marginBottom:8}}>🏆</Text>
      <Text style={{color:'#FFF',fontSize:28,fontWeight:'800'}}>המשחק נגמר!</Text>
      <Text style={{color:'#FACC15',fontSize:20,fontWeight:'700',marginTop:8,marginBottom:24}}>{state.winner?.name} ניצח/ה!</Text>
      <View style={{backgroundColor:'rgba(55,65,81,0.5)',borderRadius:12,padding:16,width:'100%'}}>
        <Text style={{color:'#9CA3AF',fontSize:11,fontWeight:'700',letterSpacing:1,marginBottom:10,textAlign:'right'}}>תוצאות סופיות</Text>
        {sorted.map((p,i)=><View key={p.id} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:3}}><Text style={{color:'#D1D5DB',fontSize:14}}>{i+1}. {p.name}{p.hand.length===0?' ★':''}</Text><Text style={{color:'#9CA3AF',fontSize:14}}>{p.hand.length} קלפים נותרו</Text></View>)}
      </View>
      <LulosButton text="שחק/י שוב" color="green" width={280} height={64} onPress={()=>dispatch({type:'RESET_GAME'})} style={{marginTop:20}} />
    </View>
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

// ═══════════════════════════════════════════════════════════════
//  SPLASH SCREEN — animated loading with jester + math operators
// ═══════════════════════════════════════════════════════════════

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const jokerScale = useRef(new Animated.Value(0)).current;
  const jokerBounce = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashScale = useRef(new Animated.Value(1)).current;
  const loadingWidth = useRef(new Animated.Value(0)).current;
  const loadingTextOpacity = useRef(new Animated.Value(0.3)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const opScales = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const opFloats = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    // Joker spring entry
    Animated.spring(jokerScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();

    // Continuous bounce (4s loop, 8px)
    Animated.loop(
      Animated.sequence([
        Animated.timing(jokerBounce, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(jokerBounce, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Operator pop-ins with staggered delays
    const delays = [800, 1000, 1200, 1400];
    const timers: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        Animated.spring(opScales[i], { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }).start();
        Animated.loop(
          Animated.sequence([
            Animated.timing(opFloats[i], { toValue: -6, duration: 1800 + i * 200, useNativeDriver: true }),
            Animated.timing(opFloats[i], { toValue: 6, duration: 1800 + i * 200, useNativeDriver: true }),
          ])
        ).start();
      }, delay));
    });

    // Subtitle fade in
    Animated.timing(subtitleOpacity, { toValue: 1, duration: 800, delay: 500, useNativeDriver: true }).start();

    // Loading bar (0 to 100% over 3s)
    Animated.timing(loadingWidth, { toValue: 1, duration: 3000, useNativeDriver: false }).start();

    // Loading text pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingTextOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(loadingTextOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // After 3 seconds: fade out + slight scale up
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(splashScale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
      ]).start(() => onFinish());
    }, 3000);

    return () => { timers.forEach(clearTimeout); clearTimeout(exitTimer); };
  }, []);

  const operators = [
    { sym: '✚', color: '#E53935', style: { top: '22%', left: '10%' } as any },
    { sym: '÷', color: '#1E88E5', style: { top: '18%', right: '10%' } as any },
    { sym: '✖', color: '#43A047', style: { bottom: '38%', left: '12%' } as any },
    { sym: '━', color: '#FFA000', style: { bottom: '35%', right: '12%' } as any },
  ];

  return (
    <Animated.View style={{
      ...StyleSheet.absoluteFillObject,
      opacity: splashOpacity,
      transform: [{ scale: splashScale }],
      zIndex: 999,
    }}>
      <LinearGradient
        colors={['#0a1628', '#0f1d32']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <StatusBar style="light" />

        {/* Floating math operators */}
        {operators.map((op, i) => (
          <Animated.View key={i} style={{
            position: 'absolute', ...op.style,
            opacity: opScales[i],
            transform: [{ scale: opScales[i] }, { translateY: opFloats[i] }],
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: op.color }}>{op.sym}</Text>
          </Animated.View>
        ))}

        {/* Joker image with golden glow */}
        <Animated.View style={{
          width: 220, height: 220, alignItems: 'center', justifyContent: 'center',
          borderRadius: 24, overflow: 'hidden',
          transform: [{ scale: jokerScale }, { translateY: jokerBounce }],
          ...Platform.select({
            ios: { shadowColor: '#FFB300', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24 },
            android: { elevation: 16 },
          }),
        }}>
          <Image source={require('./assets/joker.jpg')} style={{ width: 220, height: 220 }} resizeMode="contain" />
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity, marginTop: 24 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', letterSpacing: 8, textAlign: 'center' }}>
            משחק קלפים
          </Text>
        </Animated.View>

        {/* Loading bar */}
        <View style={{ marginTop: 48, alignItems: 'center' }}>
          <View style={{ width: 160, height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <Animated.View style={{
              width: loadingWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
              height: 3,
            }}>
              <LinearGradient
                colors={['#FFB300', '#FF8F00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ flex: 1, borderRadius: 2 }}
              />
            </Animated.View>
          </View>
          <Animated.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 12, opacity: loadingTextOpacity }}>
            ...טוען
          </Animated.Text>
        </View>

        {/* Version */}
        <View style={{ position: 'absolute', bottom: 32 }}>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center' }}>v1.0.0</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function App() {
  const [fontsLoaded] = useFonts({ Fredoka_700Bold });
  const [showSplash, setShowSplash] = useState(true);
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <GameProvider>
        <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
          <StatusBar style="light" />
          <ConditionalFloatingBg />
          <GameRouter />
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        </View>
      </GameProvider>
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
