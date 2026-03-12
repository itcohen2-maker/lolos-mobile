// ============================================================
// index.tsx — Lolos Card Game — FULL SINGLE FILE
// LinearGradient cards, 3D shadows, rotated deck, thick edges
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  I18nManager, View, Text, TextInput, ScrollView, TouchableOpacity, Image, ImageBackground,
  StyleSheet, Animated, Easing, Dimensions, Modal as RNModal, Platform, PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { registerRootComponent } from 'expo';
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle as SvgCircle, Rect as SvgRect, Path as SvgPath, Polygon as SvgPolygon } from 'react-native-svg';
import { GoldDieFace } from './AnimatedDice';
// RoamingDice inlined below (was ./components/RoamingDice)
import { GoldDiceButton } from './components/GoldDiceButton';
import { LulosButton } from './components/LulosButton';
import { CasinoButton } from './components/CasinoButton';
import { WalkingDice } from './components/WalkingDice';
import TimerBar from './components/TimerBar';
import GoldArrow from './components/GoldArrow';
const pokerTableImg = require('./assets/table.png');
const gameBgImg = require('./assets/bg.jpg');
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';


I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** גובה אזור היד (מניפה) — זהה במסך השחקן (TurnTransition) ובמסך המשחק (GameScreen) */
const HAND_STRIP_HEIGHT = 180;

// ═══════════════════════════════════════════════════════════════
//  SHARED SAFE AREA
// ═══════════════════════════════════════════════════════════════
function useGameSafeArea() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 20);
  return { safeBottom, SAFE_BOTTOM_PAD: safeBottom + 16, insets };
}

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
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
  equationOpCard: Card | null;
  equationOpPosition: number | null;
  equationOpJokerOp: Operation | null;
  lastMoveMessage: string | null;
  lastDiscardCount: number;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  diceMode: '2' | '3';
  showFractions: boolean;
  showPossibleResults: boolean;
  timerSetting: '30' | '45' | 'off';
  winner: Player | null;
  message: string;
  roundsPlayed: number;
  notifications: Notification[];
}

interface Notification {
  id: string;
  message: string;
  emoji?: string;
  title?: string;
  body?: string;
  style: 'success' | 'warning' | 'info' | 'celebration' | 'error';
  autoDismissMs?: number;
}

type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full'; diceMode: '2' | '3'; fractions: boolean; showPossibleResults: boolean; timerSetting: '30' | '45' | 'off' }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE'; values?: DiceResult }
  | { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string; equationOps: Operation[] }
  | { type: 'REVERT_TO_BUILDING' }
  | { type: 'STAGE_CARD'; card: Card }
  | { type: 'UNSTAGE_CARD'; card: Card }
  | { type: 'CONFIRM_STAGED' }
  | { type: 'CONFIRM_TRAP_ONLY' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'PLAY_OPERATION'; card: Card }
  | { type: 'FORWARD_CHALLENGE'; card: Card }
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

  | { type: 'PUSH_NOTIFICATION'; payload: Notification }
  | { type: 'DISMISS_NOTIFICATION'; id: string }
  | { type: 'RESTORE_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'UPDATE_PLAYER_NAME'; playerIndex: number; name: string }
  | { type: 'RESET_GAME' };

// Global mutable intercept for fraction card taps (tutorial + hint)
const fracTapIntercept = { fn: null as ((card: Card) => boolean) | null };

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
      { frac: '1/4', count: 3 }, { frac: '1/5', count: 2 },
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
  for (let i = 0; i < 4; i++)
    cards.push({ id: makeId(), type: 'wild' });
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
    if (opt.result >= 0 && opt.result <= 25 && !byResult.has(opt.result)) byResult.set(opt.result, opt);
  return Array.from(byResult.values()).sort((a, b) => a.result - b.result);
}

function generateValidTargets2Dice(die1: number, die2: number): EquationOption[] {
  const seen = new Set<string>();
  const results: EquationOption[] = [];
  for (const op of ALL_OPS) {
    const r1 = applyOperation(die1, op, die2);
    if (r1 !== null && r1 >= 0 && Number.isInteger(r1)) {
      const eq1 = `${die1} ${op} ${die2} = ${r1}`;
      if (!seen.has(`${r1}:${eq1}`)) { seen.add(`${r1}:${eq1}`); results.push({ equation: eq1, result: r1 }); }
    }
    const r2 = applyOperation(die2, op, die1);
    if (r2 !== null && r2 >= 0 && Number.isInteger(r2)) {
      const eq2 = `${die2} ${op} ${die1} = ${r2}`;
      if (!seen.has(`${r2}:${eq2}`)) { seen.add(`${r2}:${eq2}`); results.push({ equation: eq2, result: r2 }); }
    }
  }
  const byResult = new Map<number, EquationOption>();
  for (const opt of results)
    if (opt.result >= 0 && opt.result <= 25 && !byResult.has(opt.result)) byResult.set(opt.result, opt);
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
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount > 1) return false;
  if (wildCount === 1) {
    if (!opCard) {
      const sum = values.reduce((s, v) => s + v, 0);
      const wildVal = target - sum;
      return wildVal >= 0 && wildVal <= 25 && Number.isInteger(wildVal);
    }
    const op = opCard.operation!;
    for (let wildVal = 0; wildVal <= 25; wildVal++) {
      const allVals = [...values, wildVal];
      const perms = getStagedPermutations(allVals);
      for (const perm of perms) {
        for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
          let result: number | null = perm[0];
          for (let i = 1; i < perm.length; i++) {
            const useOp = i - 1 === gapPos ? op : '+';
            result = applyOperation(result!, useOp as Operation, perm[i]);
            if (result === null) break;
          }
          if (result !== null && result === target) return true;
        }
      }
    }
    return false;
  }
  if (values.length === 0) return false;
  if (!opCard) return values.reduce((s, v) => s + v, 0) === target;
  const op = opCard.operation!;
  const perms = getStagedPermutations(values);
  for (const perm of perms) {
    for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
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

function computeWildValueInStaged(numberCards: Card[], opCard: Card | null, target: number): number | null {
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount !== 1) return null;
  if (!opCard) {
    const wildVal = target - values.reduce((s, v) => s + v, 0);
    return wildVal >= 0 && wildVal <= 25 && Number.isInteger(wildVal) ? wildVal : null;
  }
  const op = opCard.operation!;
  for (let wildVal = 0; wildVal <= 25; wildVal++) {
    const allVals = [...values, wildVal];
    const perms = getStagedPermutations(allVals);
    for (const perm of perms) {
      for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
        let result: number | null = perm[0];
        for (let i = 1; i < perm.length; i++) {
          const useOp = i - 1 === gapPos ? op : '+';
          result = applyOperation(result!, useOp as Operation, perm[i]);
          if (result === null) break;
        }
        if (result !== null && result === target) return wildVal;
      }
    }
  }
  return null;
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
//
// ── TODO: UNIFIED NOTIFICATION SYSTEM — IRON RULES ──
//
// 1. ONE FIXED ZONE: A single <NotificationZone /> component in GameScreen,
//    always at the same screen position (absolute, below header). Never moves.
//
// 2. STATE-OWNED: Notifications live in reducer state as notifications: Notification[],
//    NOT derived from props or local useState. They survive re-renders.
//    Actions: PUSH_NOTIFICATION, DISMISS_NOTIFICATION.
//
// 3. QUEUE-BASED: Highest priority shown first. Dismissing reveals the next.
//    Priority order: frac-challenge > op-challenge > identical > op-celeb >
//    prev-action > frac-hint > eq-error > info.
//
// 4. TYPES: 'prev-action' | 'op-challenge' | 'frac-challenge' | 'identical' |
//    'frac-hint' | 'op-celeb' | 'eq-error' | 'info'.
//    Each has: id, type, title, body, autoDismissMs?, actions?, defense?, priority.
//
// 5. NEVER LOST: Notifications are only removed by explicit DISMISS_NOTIFICATION
//    dispatch. Phase changes, re-renders, or state updates do NOT clear them.
//
// 6. AUTO-DISMISS: Managed by the NotificationZone component via useEffect timer
//    that dispatches DISMISS_NOTIFICATION when autoDismissMs expires.
//
// 7. REPLACES: turnToast, opFeedback, opChallengeVisible, fracHintVisible,
//    fracToast, identicalAlert sheet, fraction challenge sheet — all consolidated.
//

const CARDS_PER_PLAYER = 7;

const initialState: GameState = {
  phase: 'setup', players: [], currentPlayerIndex: 0, drawPile: [], discardPile: [],
  dice: null, selectedCards: [], stagedCards: [], validTargets: [], equationResult: null,
  equationOpsUsed: [], activeOperation: null, challengeSource: null, activeFraction: null, pendingFractionTarget: null,
  fractionPenalty: 0, fractionAttackResolved: false, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
  consecutiveIdenticalPlays: 0, identicalAlert: null, jokerModalOpen: false, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null,
  lastMoveMessage: null, lastDiscardCount: 0, lastEquationDisplay: null,
  difficulty: 'full', diceMode: '3', showFractions: true, showPossibleResults: true, timerSetting: 'off', winner: null, message: '',
  roundsPlayed: 0,
  notifications: [],
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
  if (cp.hand.length === 0)
    return { ...st, phase: 'game-over', winner: cp };
  return st;
}

function endTurnLogic(st: GameState): GameState {
  let s = { ...st };
  // Keep activeOperation only if the current player SET a new challenge this turn
  const keepOp = !!s.activeOperation && s.hasPlayedCards;
  const up = s.players[s.currentPlayerIndex];
  if (up.hand.length === 1 && !up.calledLolos) {
    s.message = `${up.name} לא לחץ/ה "כמעט סיימתי" — אין עונש.`;
  }
  const next = (s.currentPlayerIndex + 1) % s.players.length;
  // Push turn notification from lastMoveMessage for the next player
  if (s.lastMoveMessage) {
    console.log('[END_TURN] pushing notification:', s.lastMoveMessage.slice(0, 40));
    s = { ...s, notifications: [...s.notifications, {
      id: `turn-${Date.now()}`,
      message: s.lastMoveMessage,
      style: 'info' as const,
      autoDismissMs: 4000,
    }]};
  }
  return {
    ...s,
    players: s.players.map(p => ({ ...p, calledLolos: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
    activeOperation: keepOp ? s.activeOperation : null,
    challengeSource: keepOp ? s.challengeSource : null,
    equationOpsUsed: [],
    activeFraction: null, identicalAlert: null, hasPlayedCards: false,
    hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null,
    fractionPenalty: 0, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null,
    lastDiscardCount: 0,
    roundsPlayed: s.roundsPlayed + 1,
  };
}

function gameReducer(st: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      AsyncStorage.removeItem('lulos_guidance_notifications');
      const deck = shuffle(generateDeck(action.difficulty, action.fractions));
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
        ...initialState, phase: 'turn-transition', difficulty: action.difficulty, diceMode: action.diceMode,
        showFractions: action.fractions, showPossibleResults: action.showPossibleResults, timerSetting: action.timerSetting,
        players: action.players.map((p, i) => ({ id: i, name: p.name, hand: hands[i], calledLolos: false })),
        drawPile, discardPile: firstDiscard ? [firstDiscard] : [],
      };
    }
    case 'NEXT_TURN': {
      console.log('NEXT_TURN, pendingFractionTarget was:', st.pendingFractionTarget);
      const next = (st.currentPlayerIndex + 1) % st.players.length;
      return { ...st, players: st.players.map(p => ({ ...p, calledLolos: false })), currentPlayerIndex: next, phase: 'turn-transition', dice: null, selectedCards: [], stagedCards: [], equationResult: null, validTargets: [], message: '', activeOperation: null, challengeSource: null, equationOpsUsed: [], hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, lastDiscardCount: 0, pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: false, equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null };
    }
    case 'BEGIN_TURN': {
      console.log('BEGIN_TURN: pendingFractionTarget=', st.pendingFractionTarget, 'fractionAttackResolved=', st.fractionAttackResolved, 'topCard=', st.discardPile[st.discardPile.length-1]?.type, st.discardPile[st.discardPile.length-1]?.fraction);
      // activeOperation is purely informational — challenge card stays on pile, player plays normally
      // Fraction attack: explicit pending attack (from PLAY_FRACTION)
      if (st.pendingFractionTarget !== null && !st.fractionAttackResolved) {
        return { ...st, phase: 'pre-roll', message: '' };
      }
      // Fraction attack: auto-detect fraction card on top of discard pile
      // Skip if the fraction was already resolved (penalty taken or defense played)
      const topDiscard = st.discardPile[st.discardPile.length - 1];
      if (topDiscard && topDiscard.type === 'fraction' && !st.fractionAttackResolved) {
        const denom = fractionDenominator(topDiscard.fraction!);

        return { ...st, phase: 'pre-roll', pendingFractionTarget: denom, fractionPenalty: denom, fractionAttackResolved: false, message: '' };
      }
      // Normal turn — reset the resolved flag; notify if fraction chain just ended
      const fracChainEnded = st.fractionAttackResolved && topDiscard?.type === 'fraction';
      return { ...st, phase: 'pre-roll', fractionAttackResolved: false, pendingFractionTarget: null, fractionPenalty: 0, message: fracChainEnded ? 'סבב השברים הסתיים — הטל קוביות' : '' };
    }
    case 'ROLL_DICE': {
      if (st.phase !== 'pre-roll') return st;
      let dice: DiceResult;
      if (st.diceMode === '2') {
        if (action.values) {
          dice = { die1: action.values.die1, die2: action.values.die2, die3: 0 };
        } else {
          dice = { die1: Math.floor(Math.random() * 6) + 1, die2: Math.floor(Math.random() * 6) + 1, die3: 0 };
        }
      } else {
        dice = action.values || rollDiceUtil();
      }
      let ns: GameState = { ...st, dice };
      if (st.diceMode === '3' && isTriple(dice)) {
        let s = { ...ns, players: ns.players.map(p => ({ ...p, hand: [...p.hand] })) };
        for (let i = 0; i < s.players.length; i++) if (i !== st.currentPlayerIndex) s = drawFromPile(s, dice.die1, i);
        s.message = `שלישייה של ${dice.die1}! כל שאר השחקנים שולפים ${dice.die1} קלפים!`;
        ns = s;
      }
      const vt = st.diceMode === '2' ? generateValidTargets2Dice(dice.die1, dice.die2) : generateValidTargets(dice);
      return { ...ns, validTargets: vt, phase: 'building', consecutiveIdenticalPlays: 0, message: ns.message || '' };
    }
    case 'CONFIRM_EQUATION': {
      if (st.phase !== 'building') return st;
      return { ...st, phase: 'solved', equationResult: action.result, equationOpsUsed: action.equationOps, lastEquationDisplay: action.equationDisplay, stagedCards: [], message: '' };
    }
    case 'REVERT_TO_BUILDING': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      return { ...st, phase: 'building', equationResult: null, equationOpsUsed: [], lastEquationDisplay: null, stagedCards: [], message: '' };
    }
    case 'STAGE_CARD': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      if (st.stagedCards.some(c => c.id === action.card.id)) return st;
      if (action.card.type !== 'number' && action.card.type !== 'operation' && action.card.type !== 'wild') return st;
      if (action.card.type === 'wild' && st.stagedCards.some(c => c.type === 'wild')) return st;
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
      const stNumbers = st.stagedCards.filter(c => c.type === 'number' || c.type === 'wild');
      const stOpCards = st.stagedCards.filter(c => c.type === 'operation');
      const stOpCard = stOpCards.length === 1 ? stOpCards[0] : null;
      if (stNumbers.length === 0) return { ...st, message: 'יש לבחור לפחות קלף מספר אחד או פרא' };
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
      const eqChallenge = (st.equationOpCard && st.equationOpPosition !== null) ? eqOp! : null;
      const stNewActiveOp = eqChallenge ?? (stOpCard ? stOpCard.operation! : null);
      const stLastNum = stNumbers[stNumbers.length - 1];
      const lastCardVal = stLastNum.type === 'wild'
        ? computeWildValueInStaged(stNumbers, stOpCard, st.equationResult!)
        : (stLastNum.value ?? null);
      // Soft enforcement: check if challenged player used the required operation
      const hadChallenge = !!st.activeOperation;
      const challengeOp = st.activeOperation;
      const usedChallengeOp = hadChallenge && challengeOp
        ? st.equationOpsUsed.includes(challengeOp)
        : false;
      const placedNewOp = !!stNewActiveOp;
      let feedbackType: string | null = null;
      if (hadChallenge && usedChallengeOp && placedNewOp) {
        feedbackType = 'double-move';
      } else if (hadChallenge && usedChallengeOp) {
        feedbackType = 'challenge-success';
      } else if (hadChallenge && !usedChallengeOp) {
        feedbackType = 'challenge-penalty';
      } else if (placedNewOp) {
        feedbackType = 'attack-sent';
      }
      // Penalty: draw 1 card if challenged but didn't use the operation
      let penaltyPlayers = stNp;
      let penaltyDrawPile = st.drawPile;
      if (feedbackType === 'challenge-penalty') {
        const penResult = drawFromPile({ ...st, players: stNp } as GameState, 1, st.currentPlayerIndex);
        penaltyPlayers = penResult.players;
        penaltyDrawPile = penResult.drawPile;
      }
      const stToast = feedbackType === 'double-move'
        ? `🌟 ${stCp.name}: מהלך כפול! תקיפה + פתרון!`
        : feedbackType === 'challenge-success'
        ? `🎉 ${stCp.name} התמודד/ה עם האתגר!`
        : feedbackType === 'challenge-penalty'
        ? `😬 ${stCp.name} לא השתמש/ה בסימן האתגר — קלף עונש!`
        : feedbackType === 'attack-sent'
        ? `🎯 ${stCp.name}: אתגר הוטל!`
        : `✅ ${stCp.name}: \u2066${st.lastEquationDisplay || ''}\u2069 → הניח ${stLastNum.type === 'wild' ? `פרא (${lastCardVal})` : stLastNum.value}`;
      // TODO: add dedicated sound effect per discard count
      let stNs: GameState = { ...st, players: penaltyPlayers, drawPile: penaltyDrawPile, discardPile: stDiscard, stagedCards: [], selectedCards: [], consecutiveIdenticalPlays: 0, hasPlayedCards: true, lastCardValue: lastCardVal, activeOperation: stNewActiveOp || null, challengeSource: stNewActiveOp ? stCp.name : null, equationOpsUsed: [], equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null, lastMoveMessage: stToast, lastDiscardCount: stIds.size, lastEquationDisplay: null, message: stNewActiveOp ? `אתגר פעולה ${stNewActiveOp} לשחקן הבא!` : '' };
      stNs = checkWin(stNs);
      if (stNs.phase === 'game-over') return stNs;
      // Discard celebration notification
      const stDiscardCount = stIds.size;
      if (stDiscardCount > 0) {
        const dcMsg = stDiscardCount === 1 ? '🎉 יש לנו פחות קלף אחד!'
          : stDiscardCount === 2 ? '🎉 יש לנו פחות 2 קלפים!'
          : `🔥 יש לנו פחות ${stDiscardCount} קלפים! מדהים!`;
        stNs = { ...stNs, notifications: [...stNs.notifications, {
          id: `discard-${Date.now()}`,
          message: dcMsg,
          style: (stDiscardCount >= 3 ? 'celebration' : 'success') as 'celebration' | 'success',
          autoDismissMs: 2500,
        }]};
      }
      return { ...endTurnLogic(stNs), lastDiscardCount: stIds.size };
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
      let trapNs: GameState = { ...st, players: trapNp, discardPile: trapDiscard, stagedCards: [], selectedCards: [], consecutiveIdenticalPlays: 0, hasPlayedCards: true, lastCardValue: st.lastCardValue, activeOperation: trapOp, challengeSource: trapCp.name, equationOpsUsed: [], equationOpCard: null, equationOpPosition: null, equationOpJokerOp: null, lastMoveMessage: `⚔️ ${trapCp.name}: הניח מלכודת ${trapOp} — אתגר!`, lastEquationDisplay: null, message: `אתגר פעולה ${trapOp} לשחקן הבא!` };
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
                          action.card.type === 'operation' ? action.card.operation! :
                          action.card.type === 'wild' ? 'פרא' : 'ג׳וקר';
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
      const encouragement: Notification = {
        id: `identical-less-${Date.now()}`,
        message: '🎉 יש לנו פחות קלף אחד!',
        style: 'success',
        autoDismissMs: 2500,
      };
      return endTurnLogic({
        ...st,
        identicalAlert: null,
        lastMoveMessage: idToast,
        notifications: [...st.notifications, encouragement],
      });
    }
    case 'PLAY_OPERATION': {
      if (st.phase !== 'pre-roll' && st.phase !== 'solved') return st;
      if (st.hasPlayedCards || action.card.type !== 'operation') return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.card.operation!, challengeSource: cp.name, selectedCards: [], hasPlayedCards: true, message: '' };
      ns = checkWin(ns);
      return ns;
    }
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
      if (!st.equationOpCard || action.position < 0 || action.position > 1) return st;
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
        const blockFracUni = action.card.fraction === '1/2' ? '½' : action.card.fraction === '1/3' ? '⅓' : action.card.fraction === '1/4' ? '¼' : action.card.fraction === '1/5' ? '⅕' : action.card.fraction;
        const blockMsg = `⚔️ ${cp.name} חסם עם שבר ${blockFracUni} — האתגר עובר אליך!`;
        return {
          ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
          currentPlayerIndex: next, phase: 'turn-transition', dice: null,
          selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
          activeOperation: null, challengeSource: cp.name, equationOpsUsed: [],
          activeFraction: null, consecutiveIdenticalPlays: 0,
          hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, lastDiscardCount: 0,
          pendingFractionTarget: newTarget, fractionPenalty: denom,
          fractionAttackResolved: false,
          lastMoveMessage: blockMsg,
          message: `${cp.name} חסם עם שבר — האתגר עובר הלאה!`,
        };
      }

      // ── ATTACK MODE: fraction played offensively ──
      console.log('PLAY_FRACTION dispatch:', action.card.fraction, 'phase:', st.phase, 'pendingFractionTarget:', st.pendingFractionTarget);
      if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') { console.log('PLAY_FRACTION REJECTED - bad phase:', st.phase); return st; }
      const newTarget = denom;
      console.log('SET pendingFractionTarget:', newTarget);
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], hasPlayedCards: true });
      if (ns.phase === 'game-over') return ns;
      const next = (ns.currentPlayerIndex + 1) % ns.players.length;
      const fracUni = action.card.fraction === '1/2' ? '½' : action.card.fraction === '1/3' ? '⅓' : action.card.fraction === '1/4' ? '¼' : action.card.fraction === '1/5' ? '⅕' : action.card.fraction;
      const atkMsg = `⚔️ ${cp.name} תקף אותך עם שבר ${fracUni}!`;
      return {
        ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
        currentPlayerIndex: next, phase: 'turn-transition', dice: null,
        selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
        activeOperation: null, challengeSource: cp.name, equationOpsUsed: [],
        activeFraction: null, consecutiveIdenticalPlays: 0,
        hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, lastDiscardCount: 0,
        pendingFractionTarget: newTarget, fractionPenalty: denom,
        fractionAttackResolved: false,
        lastMoveMessage: atkMsg,
        message: `${cp.name} תקף עם שבר!`,
      };
    }
    case 'DEFEND_FRACTION_SOLVE': {
      if (st.pendingFractionTarget === null) return st;
      // ג'וקר לא מגן מפני התקפת שבר — רק קלף מספר שמתחלק או קלף שבר (PLAY_FRACTION)
      if (action.card.type !== 'number' || !action.card.value || action.card.value % st.fractionPenalty !== 0) return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: true, lastCardValue: action.card.value ?? null, lastMoveMessage: '🛡️ הגנה מוצלחת — התור עובר לשחקן הבא', message: 'הגנה מוצלחת!' });
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns);
    }
    case 'DEFEND_FRACTION_PENALTY': {
      if (st.pendingFractionTarget === null) return st;
      const cp = st.players[st.currentPlayerIndex];
      let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
      s = { ...s, pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: true, lastMoveMessage: `📥 ${cp.name}: שלף ${st.fractionPenalty} קלפי עונשין`, message: `${cp.name} שלף/ה ${st.fractionPenalty} קלפי עונשין.` };
      return endTurnLogic(s);
    }
    case 'OPEN_JOKER_MODAL': return { ...st, jokerModalOpen: true, selectedCards: [action.card] };
    case 'CLOSE_JOKER_MODAL': return { ...st, jokerModalOpen: false, selectedCards: [] };
    case 'PLAY_JOKER': {
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns: GameState = { ...st, players: np, discardPile: [...st.discardPile, action.card], activeOperation: action.chosenOperation, challengeSource: cp.name, selectedCards: [], jokerModalOpen: false, hasPlayedCards: true, message: '' };
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
      s = { ...s, hasDrawnCard: true, activeOperation: null, challengeSource: null, equationOpsUsed: [], lastMoveMessage: `📥 ${drawCp.name}: שלף קלף מהחבילה` };
      return endTurnLogic(s);
    }
    case 'CALL_LOLOS': {
      const cp = st.players[st.currentPlayerIndex];
      if (cp.hand.length > 2) return st;
      return {
        ...st,
        players: st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, calledLolos: true } : p),
        message: `${cp.name} הכריז/ה על סיום!`,
      };
    }
    case 'END_TURN': return endTurnLogic(st);
    case 'SET_MESSAGE': return { ...st, message: action.message };
    case 'PUSH_NOTIFICATION': {
      const next = [...st.notifications, action.payload];
      const id = action.payload.id;
      if (id.startsWith('guidance-') || id.startsWith('onb-')) {
        AsyncStorage.setItem('lulos_guidance_notifications', JSON.stringify(next.filter(n => n.id.startsWith('guidance-') || n.id.startsWith('onb-')).slice(-10)));
      }
      console.log('[PUSH]', JSON.stringify({id:action.payload.id,title:action.payload.title,emoji:action.payload.emoji,msg:action.payload.message?.slice(0,40),style:action.payload.style}));
      return { ...st, notifications: next };
    }
    case 'DISMISS_NOTIFICATION': {
      const next = st.notifications.filter(n => n.id !== action.id);
      if (action.id.startsWith('guidance-') || action.id.startsWith('onb-')) {
        const toStore = next.filter(n => n.id.startsWith('guidance-') || n.id.startsWith('onb-'));
        if (toStore.length) AsyncStorage.setItem('lulos_guidance_notifications', JSON.stringify(toStore));
        else AsyncStorage.removeItem('lulos_guidance_notifications');
      }
      console.log('[DISMISS]', action.id, 'remaining:', next.length);
      return { ...st, notifications: next };
    }
    case 'RESTORE_NOTIFICATIONS':
      return { ...st, notifications: action.payload };
    case 'UPDATE_PLAYER_NAME':
      return { ...st, players: st.players.map((p, i) => i === action.playerIndex ? { ...p, name: action.name } : p) };
    case 'RESET_GAME':
      AsyncStorage.removeItem('lulos_guidance_notifications');
      return initialState;
    default: return st;
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONTEXT
// ═══════════════════════════════════════════════════════════════

const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> }>({ state: initialState, dispatch: () => undefined });
function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  useEffect(() => {
    AsyncStorage.getItem('lulos_guidance_notifications').then((raw) => {
      if (!raw) return;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) dispatch({ type: 'RESTORE_NOTIFICATIONS', payload: arr });
      } catch (_) {}
    });
  }, []);
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
//  RULES SCREEN — מסך כללים + טיפ של התור
// ═══════════════════════════════════════════════════════════════

function getTipOfTheTurn(st: GameState): string {
  const cp = st.players[st.currentPlayerIndex];
  if (!cp) return 'התחל משחק כדי לראות טיפים בהתאם לתור.';
  const td = st.discardPile[st.discardPile.length - 1];
  if (st.phase === 'pre-roll') {
    if (st.activeOperation && !st.hasPlayedCards)
      return 'טיפ: השתמש בסימן האתגר בתרגיל, או הנח קלף מקביל כדי להעביר את האתגר.';
    if (st.pendingFractionTarget !== null)
      return `טיפ: הנח קלף ${st.pendingFractionTarget} או שבר מתאים, או שלוף ${st.fractionPenalty} קלפים.`;
    if (!st.hasPlayedCards && st.consecutiveIdenticalPlays < 2 && td && cp.hand.some(c => validateIdenticalPlay(c, td)))
      return 'טיפ: יש לך קלף זהה לערימה — הנח אותו כדי לדלג על הקוביות!';
    return 'טיפ: הטל קוביות או הנח קלף זהה לערימה (אם יש).';
  }
  if (st.phase === 'building')
    return 'טיפ: בנה תרגיל מהקוביות. אפשר להשתמש ב־2 או 3 קוביות.';
  if (st.phase === 'solved' && st.equationResult != null)
    return `טיפ: בחר קלפים שסכומם ${st.equationResult} ולחץ "הנח קלפים".`;
  return 'המשחק ינחה אותך בכל תור.';
}

function CardsCatalogContent({ numberRange, fractions }: { numberRange: 'easy' | 'full'; fractions: boolean }) {
  const rangeLabel = numberRange === 'easy' ? '0–12' : '0–25';
  const items: { title: string; body: string }[] = [
    { title: `🃏 קלפי מספר (${rangeLabel})`, body: `כל קלף עם ערך מספרי מהטווח ${rangeLabel}. משמשים בתרגיל או להגנה מאתגר שבר.` },
    { title: '➕ קלף פעולה (+, −, ×, ÷)', body: 'מפעיל אתגר פעולה לשחקן הבא. אפשר להעביר עם קלף פעולה מקביל.' },
    { title: '🃏 ג\'וקר', body: 'בוחרים איזו פעולה הוא מייצג. מגן מפני אתגר פעולה; לא מגן מפני אתגר שבר.' },
    { title: '★ קלף פרא', body: 'נספר ככל מספר 0–25. בתרגיל בוחרים את הערך; אפשר גם להניח זהה לערימה.' },
  ];
  if (fractions) {
    items.splice(2, 0, { title: '½ ⅓ ¼ ⅕ קלף שבר', body: 'מחלק את היעד במכנה. גם קלף התקפה — הנח על הערימה כדי לאתגר את השחקן הבא. הגנה: קלף שמתחלק או שבר נוסף.' });
  }
  return (
    <ScrollView style={{ maxHeight: 420 }}>
      <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12, textAlign: 'right' }}>לפי ההגדרות הנוכחיות: טווח {rangeLabel}{fractions ? ', עם שברים' : ', בלי שברים'}.</Text>
      {items.map((item, i) => (
        <View key={i} style={{ marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#E2E8F0', marginBottom: 4, textAlign: 'right' }}>{item.title}</Text>
          <Text style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 20, textAlign: 'right' }}>{item.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function RulesContent({ state, onOpenCardsCatalog, numberRange, fractions }: { state: GameState | null; onOpenCardsCatalog?: () => void; numberRange?: 'easy' | 'full'; fractions?: boolean }) {
  const tip = state ? getTipOfTheTurn(state) : 'התחל משחק כדי לראות טיפים בהתאם לתור.';
  const range = numberRange ?? state?.difficulty ?? 'full';
  const frac = fractions ?? state?.showFractions ?? true;
  return (
    <ScrollView style={{ maxHeight: 400 }}>
      {/* טיפ של התור */}
      <View style={{ backgroundColor: 'rgba(52,168,83,0.2)', borderRadius: 12, borderWidth: 2, borderColor: '#4ADE80', padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#4ADE80', marginBottom: 6, textAlign: 'right' }}>💡 טיפ של התור</Text>
        <Text style={{ color: '#D1FAE5', fontSize: 13, lineHeight: 20, textAlign: 'right' }}>{tip}</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(59,130,246,0.2)', borderRadius: 12, borderWidth: 2, borderColor: '#93C5FD', padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#93C5FD', marginBottom: 8, textAlign: 'right' }}>👋 משתמש חדש?</Text>
        <Text style={{ color: '#E2E8F0', fontSize: 14, lineHeight: 22, textAlign: 'right' }}>המטרה — להיפטר מכל הקלפים ביד. כל תור: מגלגלים קוביות, בונים תרגיל ובוחרים קלפים שסכומם מתאים. למטה: סוגי הקלפים ואתגרים.</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#93C5FD', marginBottom: 8, textAlign: 'right' }}>סוגי קלפים</Text>
      {[
        '🃏 קלף מספר — משמש בתרגיל או להגנה מאתגר שבר.',
        '½ ⅓ ¼ ⅕ קלף שבר — גם להתקפה: השחקן הבא צריך קלף שמתחלק במכנה, או שבר נוסף, או לשלוף עונש.',
        '➕ קלף פעולה (+, −, ×, ÷) — מפעיל אתגר פעולה לשחקן הבא. אפשר להעביר את האתגר עם קלף פעולה מקביל.',
        '🃏 ג\'וקר — בוחרים איזו פעולה הוא מייצג. מגן מפני אתגר פעולה; לא מגן מפני אתגר שבר.',
        '★ קלף פרא — נספר ככל מספר 0–25. בתרגיל בוחרים את הערך; אפשר גם להניח זהה לערימה.',
      ].map((r, i) => (
        <Text key={`cards${i}`} style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, marginBottom: 6, textAlign: 'right' }}>{r}</Text>
      ))}
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#93C5FD', marginTop: 12, marginBottom: 8, textAlign: 'right' }}>בסיסי</Text>
      {[
        '🃏 כל שחקן מקבל 7 קלפים. הראשון שמרוקן את היד — מנצח!',
        '🎯 הטל 3 קוביות ובנה תרגיל (אפשר 2 קוביות בלבד).',
        '🃏 בחר קלפים מהיד שסכומם שווה לתוצאת התרגיל.',
        '🔄 קלף זהה: הנח קלף זהה לערימה כדי לדלג על הקוביות (מוגבל לפעמיים ברצף).',
      ].map((r, i) => (
        <Text key={`b${i}`} style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, marginBottom: 6, textAlign: 'right' }}>{r}</Text>
      ))}
      <View style={{ backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 12, borderWidth: 2, borderColor: '#FB923C', padding: 14, marginTop: 18, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FB923C', marginBottom: 10, textAlign: 'right' }}>⚔️ אתגר שבר</Text>
        <Text style={{ color: '#FED7AA', fontSize: 13, lineHeight: 22, textAlign: 'right', marginBottom: 8 }}>קלף שבר (½, ⅓, ¼, ⅕) — התקפה על השחקן הבא:</Text>
        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 22, textAlign: 'right', marginBottom: 4 }}>• הנח שבר על מספר שמתחלק במכנה. השחקן הבא: מניח קלף שמתחלק, או שבר נוסף (העברה), או שולף קלפי עונש.</Text>
        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 22, textAlign: 'right', marginBottom: 4 }}>• הגנה: קלף מספר מתחלק. התקפה נגדית: שבר נוסף.</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 12, borderWidth: 2, borderColor: '#A78BFA', padding: 14, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#A78BFA', marginBottom: 8, textAlign: 'right' }}>🎯 אתגר פעולה</Text>
        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 22, textAlign: 'right' }}>קלף פעולה במהלך הנחת קלפים — מאתגר את השחקן הבא. הוא חייב להשתמש באותו סימן בתרגיל, או להניח קלף פעולה מקביל (➕↔━, ✖↔÷) כדי להעביר את האתגר. אחרת — שלוף קלף עונש.</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#93C5FD', marginTop: 12, marginBottom: 8, textAlign: 'right' }}>מיוחד</Text>
      {[
        '⚡ שלישייה בקוביות: כל שאר השחקנים שולפים קלפים כמספר הקובייה.',
      ].map((r, i) => (
        <Text key={`s${i}`} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20, marginBottom: 6, textAlign: 'right' }}>{r}</Text>
      ))}
      {onOpenCardsCatalog && (
        <View style={{ marginTop: 20, marginBottom: 8, alignItems: 'center' }}>
          <LulosButton text="פירוט קלפים במשחק" color="blue" width={200} height={40} fontSize={14} onPress={onOpenCardsCatalog} />
        </View>
      )}
    </ScrollView>
  );
}

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

// Mini result card — מסגרת שטוחה וברורה, בלי נפח/בֶבֶל
const MINI_W = 36;
const MINI_H = 48;
const MINI_R = 8;
function MiniResultCard({ value, index = 0 }: { value: number; index?: number }) {
  const cl = getNumColors(value);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const stagger = index * 120;
    Animated.sequence([
      Animated.delay(stagger),
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, [index]);
  const rotateY = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });
  const scale = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.05, 1] });
  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ perspective: 800 }, { rotateY }, { scale }] }}>
      <View style={{
        width: MINI_W, height: MINI_H, borderRadius: MINI_R, overflow: 'hidden',
        borderWidth: 1.5, borderColor: cl.border,
        backgroundColor: 'rgba(255,255,255,0.95)',
      }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.9)', 'rgba(248,248,248,0.85)', 'rgba(240,240,240,0.9)']}
          locations={[0, 0.6, 1]}
          start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{
            fontSize: 18, fontWeight: '900', color: cl.face,
            textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1,
          }}>{value}</Text>
        </View>
      </View>
    </Animated.View>
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
const parallelOp: Record<string, string> = { '+': '-', '-': '+', 'x': '/', '/': 'x' };

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
              {/* Joker image centered */}
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={require('./assets/joker.jpg')} style={{ width: svgSize, height: svgSize, borderRadius: 6 }} resizeMode="contain" />
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

function WildCard({ card: _c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const fs = small ? 22 : 26;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: w, height: h, borderRadius: 12,
          transform: [{ translateY: selected ? -8 : 0 }],
        }, selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10)]}>
          <LinearGradient
            colors={['#7C3AED', '#5B21B6', '#4C1D95', '#6D28D9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: w, height: h, borderRadius: 12, padding: 3 }}
          >
            <View style={{ flex: 1, borderRadius: 9, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#EDE9FE', '#DDD6FE', '#C4B5FD']}
                locations={[0, 0.5, 1]}
                start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View style={{
                position: 'absolute', top: -(h * 0.12), left: w * 0.1,
                width: w * 0.8, height: h * 0.4, borderRadius: w,
                backgroundColor: 'rgba(255,255,255,0.5)',
              }} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: fs, fontWeight: '900', color: '#5B21B6', textAlign: 'center' }}>★</Text>
                <Text style={{ fontSize: small ? 10 : 11, fontWeight: '700', color: '#6D28D9', marginTop: 2 }}>0–25</Text>
              </View>
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
    case 'wild': return <WildCard card={card} selected={selected} onPress={onPress} small={small} />;
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

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  // Second card from top — peek beneath the top card
  const secondCard = pileSize > 1 ? state.discardPile[hasSpill && pileSize > 2 ? pileSize - 3 : pileSize - 2] : null;

  return (
    <View style={{ alignItems:'center', gap:4 }}>
      <View style={{ width: hasSpill ? 140 : 96, height: hasSpill ? 148 : 140, alignItems:'center', justifyContent:'center' }}>
        {/* Pile layers — second card peeks out below */}
        {layers > 0 ? (<>
          {/* Bottom face-down cards for depth */}
          {layers > 2 && (
            <View style={{ position:'absolute', transform:[{rotate:discardRotations[0].rotate},{translateX:discardRotations[0].translateX},{translateY:discardRotations[0].translateY}] }}>
              <BaseCard faceDown small><></></BaseCard>
            </View>
          )}
          {/* Second card — offset to peek below top card */}
          {secondCard && (
            <View style={{ position:'absolute', transform:[{rotate:'-3deg'},{translateX:-6},{translateY:18}] }}>
              <GameCard card={secondCard} small />
            </View>
          )}
          {/* Top visible card */}
          {visibleTop && (
            <View style={{ position:'absolute', transform:[{rotate:'0deg'},{translateX:0},{translateY:-6}] }}>
              <GameCard card={visibleTop} active small />
            </View>
          )}
        </>) : <View style={dpS.empty}><Text style={{color:'#6B7280',fontSize:11}}>ריק</Text></View>}

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

      </View>
    </View>
  );
}
const dpS = StyleSheet.create({ empty: { width:80, height:115, borderRadius:12, borderWidth:2, borderStyle:'dashed', borderColor:'#4B5563', alignItems:'center', justifyContent:'center' } });

// ═══════════════════════════════════════════════════════════════
//  RESULTS CHIP BUTTON (squircle casino chip)
// ═══════════════════════════════════════════════════════════════

const CHIP_W = 76;
const CHIP_H = 68;
const CHIP_R = 14;

function ResultsSlot({ onToggle, filteredResults, matchCount }: { onToggle: () => void; filteredResults: { result: number }[]; matchCount: number }) {
  return (
    <View style={{flexShrink:0}}>
      <ResultsChip onPress={onToggle} matchCount={filteredResults.length === 0 ? 0 : matchCount} />
    </View>
  );
}

function ResultsStripNearPile({ resultsOpen, filteredResults }: { resultsOpen: boolean; filteredResults: { result: number }[] }) {
  const stripSlide = useRef(new Animated.Value(0)).current;
  const stripOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (resultsOpen && filteredResults.length > 0) {
      stripSlide.setValue(20);
      stripOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(stripOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(stripSlide, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
      ]).start();
    }
  }, [resultsOpen, filteredResults.length]);
  if (!resultsOpen || filteredResults.length === 0) return null;
  return (
    <Animated.View style={{flexShrink:0,flex:1,minWidth:0,opacity:stripOpacity,transform:[{translateY:stripSlide}]}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingHorizontal:6,alignItems:'center',justifyContent:'flex-start'}}>
        {filteredResults.map((t, i) => (
          <View key={t.result} style={{width:MINI_W + 14}}>
            <MiniResultCard value={t.result} index={i} />
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function ResultsStripBelowTable({ resultsOpen, filteredResults }: { resultsOpen: boolean; filteredResults: { result: number }[] }) {
  const stripSlide = useRef(new Animated.Value(0)).current;
  const stripOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (resultsOpen && filteredResults.length > 0) {
      stripSlide.setValue(20);
      stripOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(stripOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(stripSlide, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
      ]).start();
    }
  }, [resultsOpen, filteredResults.length]);
  if (!resultsOpen || filteredResults.length === 0) return null;
  return (
    <Animated.View style={{flexShrink:0,width:'100%',alignItems:'center',justifyContent:'center',opacity:stripOpacity,transform:[{translateY:stripSlide}]}}>
      <View style={{minHeight:MINI_H + 16,backgroundColor:'transparent',paddingVertical:10,paddingHorizontal:12,width:'100%',maxWidth:360,alignItems:'center'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingHorizontal:6,alignItems:'center',justifyContent:'center'}}>
          {filteredResults.map((t, i) => (
            <View key={t.result} style={{width:MINI_W + 14}}>
              <MiniResultCard value={t.result} index={i} />
            </View>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function ResultsChip({ onPress, matchCount }: { onPress: () => void; matchCount: number }) {
  const twinkleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(twinkleAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, []);

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });
  const tw1 = twinkleAnim.interpolate({ inputRange: [0, 0.3, 0.5, 0.8, 1], outputRange: [0.1, 0.7, 0.15, 0.6, 0.1] });
  const tw2 = twinkleAnim.interpolate({ inputRange: [0, 0.2, 0.6, 0.9, 1], outputRange: [0.5, 0.1, 0.6, 0.15, 0.5] });
  const tw3 = twinkleAnim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0.15, 0.55, 0.1, 0.15] });

  const rim = 4;
  const inset = 2;
  const innerR = CHIP_R - 3;
  const feltPad = rim + inset;

  return (
    <View style={{ width: CHIP_W, height: CHIP_H + 6 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={{ width: CHIP_W, height: CHIP_H + 4, transform: [{ scale }, { translateY }] }}>
          {/* Bottom shadow */}
          <View style={{
            position: 'absolute', bottom: 0, left: 2, right: 2, height: CHIP_H,
            borderRadius: CHIP_R + 2, backgroundColor: '#1A0D00',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 },
              android: { elevation: 10 },
            }),
          }} />
          {/* Mid shadow */}
          <View style={{
            position: 'absolute', bottom: 2, left: 1, right: 1, height: CHIP_H,
            borderRadius: CHIP_R + 2, backgroundColor: '#3A2504',
          }} />
          {/* Gold rim */}
          <LinearGradient
            colors={['#FFF0A0', '#F5D45A', '#E8BC28', '#D4A010', '#C09018', '#E8C030', '#F5D860']}
            locations={[0, 0.15, 0.35, 0.55, 0.75, 0.9, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H, borderRadius: CHIP_R + 2 }}
          />
          {/* Gold specular highlight */}
          <View style={{
            position: 'absolute', top: 1, left: CHIP_R, right: CHIP_R,
            height: CHIP_H * 0.3, borderBottomLeftRadius: CHIP_H, borderBottomRightRadius: CHIP_H,
            backgroundColor: 'rgba(255,255,230,0.2)',
          }} />
          {/* Dark inset ring */}
          <View style={{
            position: 'absolute', top: rim - 1, left: rim - 1, right: rim - 1, bottom: rim + 2,
            borderRadius: CHIP_R - 1, backgroundColor: '#0A1A0E',
          }} />
          {/* Green felt surface */}
          <LinearGradient
            colors={['#2D6B48', '#245C3C', '#1C4C30', '#143824']}
            start={{ x: 0.3, y: 0.2 }} end={{ x: 0.7, y: 0.9 }}
            style={{
              position: 'absolute', top: feltPad, left: feltPad, right: feltPad, bottom: feltPad + 1,
              borderRadius: innerR, overflow: 'hidden',
            }}
          >
            {/* Felt edge vignette */}
            <View style={{
              ...StyleSheet.absoluteFillObject, borderRadius: innerR,
              borderWidth: 6, borderColor: 'rgba(0,0,0,0.2)',
            }} />
            {/* Twinkle dots */}
            <Animated.View style={{ position: 'absolute', left: '18%', top: '25%', width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(220,255,230,0.7)', opacity: tw1 }} />
            <Animated.View style={{ position: 'absolute', left: '60%', top: '50%', width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: 'rgba(220,255,230,0.6)', opacity: tw2 }} />
            <Animated.View style={{ position: 'absolute', left: '40%', top: '70%', width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(220,255,230,0.65)', opacity: tw3 }} />
            {/* Inner felt glow */}
            <View style={{
              position: 'absolute', top: 0, left: '20%', right: '20%', height: '45%',
              borderBottomLeftRadius: 100, borderBottomRightRadius: 100,
              backgroundColor: 'rgba(80,180,100,0.08)',
            }} />
          </LinearGradient>
          {/* Inner rim highlight */}
          <View style={{
            position: 'absolute', top: feltPad, left: feltPad, right: feltPad, bottom: feltPad + 1,
            borderRadius: innerR, borderWidth: 0.7, borderColor: 'rgba(80,180,100,0.22)',
          }} />
          {/* Outer gold edge highlight */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H,
            borderRadius: CHIP_R + 2, borderWidth: 0.8, borderColor: 'rgba(255,248,180,0.25)',
          }} />
          {/* Text label */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text numberOfLines={2} style={{
              color: '#F0E8B0', fontSize: 11, fontWeight: '900', textAlign: 'center', lineHeight: 14,
              textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
            }}>{`\u200Fתוצאות\nאפשריות`}</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
      {/* Match count badge */}
      {matchCount > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -4, backgroundColor: '#FFD700',
          borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#1a1a2e', zIndex: 5,
        }}>
          <Text style={{ color: '#1a1a2e', fontSize: 11, fontWeight: '900' }}>{matchCount}</Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DICE AREA
// ═══════════════════════════════════════════════════════════════

// DiceArea removed — roll button is now in SLOT 4 (notification zone)

// ── RoamingDice — walking dice characters (inlined) ──
const DICE_BODY = 40;
const DICE_PAD = 40;
const { width: SCREEN_W_DICE, height: SCREEN_H_DICE } = Dimensions.get('window');
const ROAM_MAX_Y = SCREEN_H_DICE * 0.45;
const PIP_R = 3.5;

const PIPS_MAP: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.7], [0.7, 0.3]],
  3: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

const DICE_CONFIGS = [
  { face: 4, driftBase: 5000, startX: SCREEN_W_DICE * 0.2, startY: SCREEN_H_DICE * 0.12 },
  { face: 2, driftBase: 6500, startX: SCREEN_W_DICE * 0.5, startY: SCREEN_H_DICE * 0.28 },
  { face: 6, driftBase: 4500, startX: SCREEN_W_DICE * 0.75, startY: SCREEN_H_DICE * 0.18 },
];

interface DiceCharacterRef { summon: () => void; scatter: () => void; }

const DiceCharacter = React.forwardRef<DiceCharacterRef, { config: typeof DICE_CONFIGS[0] }>(({ config }, ref) => {
  const mounted = useRef(true);
  const drifting = useRef(true);
  const driftX = useRef(new Animated.Value(config.startX)).current;
  const driftY = useRef(new Animated.Value(config.startY)).current;
  const walk = useRef(new Animated.Value(0)).current;
  const bobY = useRef(new Animated.Value(0)).current;
  const eyeX = useRef(new Animated.Value(0)).current;
  const dcOpacity = useRef(new Animated.Value(0.55)).current;
  const dcScale = useRef(new Animated.Value(1)).current;
  const pips = PIPS_MAP[config.face] || PIPS_MAP[1];

  const startDrift = useCallback(() => {
    drifting.current = true;
    const drift = () => {
      if (!mounted.current || !drifting.current) return;
      const tx = DICE_PAD + Math.random() * (SCREEN_W_DICE - DICE_PAD * 2);
      const ty = DICE_PAD + Math.random() * (ROAM_MAX_Y - DICE_PAD);
      const dur = config.driftBase + (Math.random() - 0.5) * 3000;
      Animated.parallel([
        Animated.timing(driftX, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) drift(); });
    };
    drift();
  }, []);

  useEffect(() => {
    startDrift();
    Animated.loop(Animated.timing(walk, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue: -4, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bobY, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(eyeX, { toValue: -1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(eyeX, { toValue: 1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(400),
    ])).start();
    return () => { mounted.current = false; };
  }, []);

  React.useImperativeHandle(ref, () => ({
    summon: () => {
      drifting.current = false;
      driftX.stopAnimation(); driftY.stopAnimation();
      Animated.parallel([
        Animated.timing(driftX, { toValue: SCREEN_W_DICE / 2 - DICE_BODY / 2, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: SCREEN_H_DICE * 0.3, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(dcOpacity, { toValue: 0, duration: 350, delay: 150, useNativeDriver: true }),
        Animated.timing(dcScale, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ]).start();
    },
    scatter: () => {
      const edge = Math.floor(Math.random() * 4);
      let sx: number, sy: number;
      if (edge === 0) { sx = -DICE_BODY; sy = Math.random() * ROAM_MAX_Y; }
      else if (edge === 1) { sx = SCREEN_W_DICE + DICE_BODY; sy = Math.random() * ROAM_MAX_Y; }
      else if (edge === 2) { sx = Math.random() * SCREEN_W_DICE; sy = -DICE_BODY; }
      else { sx = Math.random() * SCREEN_W_DICE; sy = ROAM_MAX_Y + DICE_BODY; }
      driftX.setValue(sx); driftY.setValue(sy); dcScale.setValue(1);
      Animated.timing(dcOpacity, { toValue: 0.55, duration: 400, useNativeDriver: true }).start(() => startDrift());
    },
  }));

  const leftLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-12deg', '0deg', '12deg', '0deg', '-12deg'] });
  const rightLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['12deg', '0deg', '-12deg', '0deg', '12deg'] });
  const leftArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['10deg', '0deg', '-15deg', '0deg', '10deg'] });
  const rightArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-10deg', '0deg', '15deg', '0deg', '-10deg'] });
  const combinedY = Animated.add(driftY, bobY);

  return (
    <Animated.View style={{ position: 'absolute', opacity: dcOpacity, transform: [{ translateX: driftX }, { translateY: combinedY as any }, { scale: dcScale }] }}>
      <View style={dcS.shadow} />
      <Animated.View style={[dcS.legPivotL, { transform: [{ rotate: leftLegRot as any }] }]}><View style={dcS.leg} /></Animated.View>
      <Animated.View style={[dcS.legPivotR, { transform: [{ rotate: rightLegRot as any }] }]}><View style={dcS.leg} /></Animated.View>
      <Animated.View style={[dcS.armPivotL, { transform: [{ rotate: leftArmRot as any }] }]}><View style={dcS.arm} /></Animated.View>
      <Animated.View style={[dcS.armPivotR, { transform: [{ rotate: rightArmRot as any }] }]}><View style={dcS.arm} /></Animated.View>
      <View style={dcS.body}>
        <LinearGradient colors={['#FFD54F', '#F5C842', '#D4A520']} style={{ width: DICE_BODY, height: DICE_BODY }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={dcS.shine} />
          {pips.map(([px, py], idx) => (
            <View key={idx} style={[dcS.pip, { left: px * DICE_BODY - PIP_R, top: py * DICE_BODY - PIP_R }]} />
          ))}
        </LinearGradient>
      </View>
      <View style={dcS.eyeRow}>
        <View style={dcS.eyeWhite}><Animated.View style={[dcS.pupil, { transform: [{ translateX: eyeX }] }]} /></View>
        <View style={dcS.eyeWhite}><Animated.View style={[dcS.pupil, { transform: [{ translateX: eyeX }] }]} /></View>
      </View>
    </Animated.View>
  );
});
DiceCharacter.displayName = 'DiceCharacter';

interface RoamingDiceRef { summon: () => void; scatter: () => void; }
const RoamingDice = React.forwardRef<RoamingDiceRef, {}>((_, ref) => {
  const d0 = useRef<DiceCharacterRef>(null);
  const d1 = useRef<DiceCharacterRef>(null);
  const d2 = useRef<DiceCharacterRef>(null);
  React.useImperativeHandle(ref, () => ({
    summon: () => { d0.current?.summon(); d1.current?.summon(); d2.current?.summon(); },
    scatter: () => { d0.current?.scatter(); d1.current?.scatter(); d2.current?.scatter(); },
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <DiceCharacter ref={d0} config={DICE_CONFIGS[0]} />
      <DiceCharacter ref={d1} config={DICE_CONFIGS[1]} />
      <DiceCharacter ref={d2} config={DICE_CONFIGS[2]} />
    </View>
  );
});
RoamingDice.displayName = 'RoamingDice';

const dcS = StyleSheet.create({
  shadow: { position: 'absolute', top: DICE_BODY + 14, left: DICE_BODY * 0.15, width: DICE_BODY * 0.7, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.15)' },
  legPivotL: { position: 'absolute', top: DICE_BODY - 2, left: DICE_BODY * 0.25 - 1.5, width: 3, height: 0, overflow: 'visible' as const },
  legPivotR: { position: 'absolute', top: DICE_BODY - 2, left: DICE_BODY * 0.65 - 1.5, width: 3, height: 0, overflow: 'visible' as const },
  leg: { width: 3, height: 18, backgroundColor: '#444', borderRadius: 1.5 },
  armPivotL: { position: 'absolute', top: DICE_BODY * 0.35, left: -1.25, width: 2.5, height: 0, overflow: 'visible' as const },
  armPivotR: { position: 'absolute', top: DICE_BODY * 0.35, left: DICE_BODY - 1.25, width: 2.5, height: 0, overflow: 'visible' as const },
  arm: { width: 2.5, height: 14, backgroundColor: '#444', borderRadius: 1.25 },
  body: { width: DICE_BODY, height: DICE_BODY, borderRadius: 8, overflow: 'hidden' as const, borderWidth: 2, borderColor: '#B8860B' },
  shine: { position: 'absolute', top: 2, left: 2, width: DICE_BODY - 4, height: DICE_BODY * 0.4, borderRadius: 6, backgroundColor: 'rgba(255,245,200,0.35)' },
  pip: { position: 'absolute', width: PIP_R * 2, height: PIP_R * 2, borderRadius: PIP_R, backgroundColor: '#333', opacity: 0.8 },
  eyeRow: { position: 'absolute', top: -10, left: 0, width: DICE_BODY, flexDirection: 'row' as const, justifyContent: 'center' as const, gap: DICE_BODY * 0.12 },
  eyeWhite: { width: 9, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 0.6, borderColor: '#bbb', alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const },
  pupil: { width: 4.4, height: 4.4, borderRadius: 2.2, backgroundColor: '#333' },
});

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


function EquationBuilder({ onConfirmChange, onResultChange }: { onConfirmChange?: (data: { onConfirm: () => void } | null) => void; onResultChange?: (data: { result: number | null; ok: boolean; hasError: boolean } | null) => void }) {
  const { state, dispatch } = useGame();

  // Dice placement: index into diceValues (0-2), or null — starts empty, player fills manually
  const [dice1, setDice1] = useState<number | null>(null);
  const [dice2, setDice2] = useState<number | null>(null);
  const [dice3, setDice3] = useState<number | null>(null);
  // Operators: null = empty, tap-to-cycle through EQ_OPS
  const [op1, setOp1] = useState<string | null>(null);
  const [op2, setOp2] = useState<string | null>(null);
  // resultsOpen removed — possible results moved to SLOT 2

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

  const showBuilder = (state.phase === 'building' || state.phase === 'solved') && state.dice && state.pendingFractionTarget === null;
  const isSolved = state.phase === 'solved';
  const diceValues = state.dice ? [state.dice.die1, state.dice.die2, state.dice.die3] : [0, 0, 0];
  const twoDiceMode = state.diceMode === '2';
  const diceValuesDisplay = twoDiceMode ? diceValues.slice(0, 2) : diceValues;

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
    const usedOps: Operation[] = [];
    if (effectiveOp1) usedOps.push(effectiveOp1 as Operation);
    if (effectiveOp2) usedOps.push(effectiveOp2 as Operation);
    dispatch({ type: 'CONFIRM_EQUATION', result: finalResult, equationDisplay: display, equationOps: usedOps });
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

  // Notify parent about result state for rendering outside the table
  useEffect(() => {
    if (onResultChange) {
      onResultChange(showBuilder ? { result: finalResult, ok, hasError } : null);
    }
  }, [finalResult, ok, hasError, showBuilder]);
  useEffect(() => () => onResultChange?.(null), []);

  if (!showBuilder) return null;

  // Whether 3rd dice slot / op2 are relevant (3-dice mode only, when sub-expression is complete)
  const show3rd = !twoDiceMode && subResult !== null;

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

    // Mini card visual when hand card is placed in this slot
    if (isHandPlaced && handOp) {
      const cardCl = isJoker ? null : (opColors[handOp] ?? opColors['+']);
      const cardBorder = isJoker ? '#A78BFA' : cardCl!.face;
      const cardBg = isJoker ? '#7C3AED' : cardCl!.face;
      const symDisplay = opDisplay[handOp] ?? handOp;

      // Joker: show joker card underneath with operation card tilted on top
      if (isJoker) {
        return (
          <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={isSolved}
            style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            {/* Joker card underneath — 60% visible */}
            <View style={{
              position: 'absolute', width: 36, height: 44, borderRadius: 7,
              backgroundColor: '#FFF', borderWidth: 2, borderColor: '#A78BFA',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ rotate: '-8deg' }, { translateX: -4 }, { translateY: 2 }],
            }}>
              <Text style={{ fontSize: 16 }}>🃏</Text>
            </View>
            {/* Operation card on top, tilted */}
            <View style={{
              width: 36, height: 44, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#FFF', borderWidth: 2, borderColor: (opColors[handOp] ?? opColors['+']).face,
              transform: [{ rotate: '10deg' }, { translateX: 4 }, { translateY: -2 }],
              ...Platform.select({
                ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
                android: { elevation: 4 },
              }),
            }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: (opColors[handOp] ?? opColors['+']).face }}>{symDisplay}</Text>
            </View>
            {/* Challenge badge */}
            <View style={{ position: 'absolute', bottom: -5, left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ backgroundColor: '#E74C3C', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '800' }}>⚔️</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      // Regular operation card
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={isSolved}
          style={{
            width: 36, height: 44, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#FFF', borderWidth: 2, borderColor: cardBorder,
            ...Platform.select({
              ios: { shadowColor: cardBg, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
              android: { elevation: 4 },
            }),
          }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: cardBg }}>{symDisplay}</Text>
          <View style={{
            position: 'absolute', bottom: -5, left: 0, right: 0, alignItems: 'center',
          }}>
            <View style={{
              backgroundColor: '#E74C3C', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4,
            }}>
              <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '800' }}>⚔️</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const isDivision = displayOp === '÷';
    const divCl = opColors['/'];
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          eqS.opBtn,
          displayOp ? (isDivision ? { backgroundColor: divCl.face, borderWidth: 0, ...Platform.select({ ios: { shadowColor: divCl.dark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.6, shadowRadius: 4 }, android: { elevation: 4 } }) } : eqS.opBtnFilled) : eqS.opBtnEmpty,
          !enabled && { opacity: 0.3 },
          isDivision && { width: 32, height: 32 },
          isWaitingPlacement && !isHandPlaced && { borderColor: '#A78BFA', borderWidth: 2, borderStyle: 'dashed' as any },
        ]}
        disabled={isSolved || !enabled}>
        {isDivision ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
            <View style={{ position: 'absolute', top: 6, left: 14, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF' }} />
            <View style={{ width: 16, height: 2.5, borderRadius: 2, backgroundColor: '#FFF' }} />
            <View style={{ position: 'absolute', bottom: 6, left: 14, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF' }} />
          </View>
        ) : (
          <Text style={[displayOp ? eqS.opBtnFilledTxt : eqS.opBtnEmptyTxt]}>
            {displayOp || '⬦'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[eqS.wrap, isSolved && { opacity: 0.5 }]}>
      {/* Dice pool */}
      {!isSolved && (
        <View style={eqS.diceRow}>
          {diceValuesDisplay.map((dv, dIdx) => {
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
                    <GoldDieFace value={dv} size={40} />
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
      <Animated.View style={{ flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 4, width: '100%', justifyContent: 'center', opacity: eqRowAnim, transform: [{ translateY: eqRowAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
        {/* Reset button */}
        {!isSolved && (
          <TouchableOpacity onPress={resetAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: '#6B7280', fontSize: 16 }}>🔄</Text>
          </TouchableOpacity>
        )}
        {/* Equation */}
        <View style={eqS.eqRow}>
          {/* Opening bracket */}
          <Text style={eqS.bracket}>(</Text>

          {renderDiceSlot(dice1, 1)}
          {renderOpBtn(1, op1, dice1 !== null)}
          {renderDiceSlot(dice2, 2)}

          {/* Closing bracket */}
          <Text style={eqS.bracket}>)</Text>

          {/* OP2 + dice3 (3-dice mode only; faded when sub-expression not complete) */}
          {!twoDiceMode && (
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 3 }, !show3rd && { opacity: 0.25 }]}>
              {renderOpBtn(2, op2, show3rd)}
              {renderDiceSlot(dice3, 3)}
            </View>
          )}
        </View>
        {/* Result on the right */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFD700' }}>=</Text>
          <View style={{ minWidth: 32, height: 34, borderRadius: 8, borderWidth: 1, borderColor: hasError ? 'rgba(234,67,53,0.3)' : ok ? 'rgba(74,222,128,0.3)' : 'rgba(255,215,0,0.2)', backgroundColor: hasError ? 'rgba(234,67,53,0.1)' : ok ? 'rgba(74,222,128,0.1)' : 'rgba(255,215,0,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
            {hasError ? (
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#EA4335' }}>✕</Text>
            ) : finalResult !== null ? (
              <Text style={{ fontSize: 18, fontWeight: '800', color: ok ? '#4ADE80' : '#FFD700' }}>{finalResult}</Text>
            ) : (
              <Text style={{ fontSize: 18, fontWeight: '800', color: 'rgba(255,215,0,0.25)' }}>?</Text>
            )}
          </View>
        </View>
      </Animated.View>


      {/* 2-dice hint (3-dice mode only) */}
      {!twoDiceMode && subResult !== null && dice3 === null && op2 === null && !isSolved && (
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
    </View>
  );
}
const eqS = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', alignSelf: 'center' as any, width: '100%', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', },
  title: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  diceRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', direction: 'ltr' as any },
  diceBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,200,60,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,200,60,0.2)', overflow: 'hidden' },
  diceBtnFace: { backgroundColor: 'transparent', borderColor: 'rgba(232,184,48,0.4)', borderWidth: 2, padding: 0 },
  diceBtnUsed: { opacity: 0.25 },
  diceBtnT: { fontSize: 20, fontWeight: '800', color: '#e8d84a' },
  diceBtnUsedT: { color: 'rgba(255,200,60,0.3)' },
  // Single equation row with container
  eqRow: { flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 3, justifyContent: 'center', alignSelf: 'center' as any, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bracket: { fontSize: 28, fontWeight: '300', color: 'rgba(255,200,60,0.35)', marginHorizontal: 0 },
  // Dice slots (compact 38×38)
  slot: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  slotFilled: { backgroundColor: '#FFF', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  slotEmpty: { borderWidth: 2, borderStyle: 'dashed' as any, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.02)' },
  slotVal: { fontSize: 19, fontWeight: '800', color: '#1a1a2e' },
  slotPlaceholder: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.15)' },
  // Operator button (compact 28×28, tap-to-cycle)
  opBtn: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  opBtnEmpty: { borderWidth: 2, borderStyle: 'dashed' as any, borderColor: '#F9A825', backgroundColor: 'transparent' },
  opBtnFilled: { backgroundColor: '#F9A825', ...Platform.select({ ios: { shadowColor: 'rgba(249,168,37,0.3)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 }, android: { elevation: 4 } }) },
  opBtnEmptyTxt: { fontSize: 12, fontWeight: '800', color: '#F9A825' },
  opBtnFilledTxt: { fontSize: 15, fontWeight: '800', color: '#1a1510' },
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

const STAGING_HINT_KEY = 'lulos_staging_hint_seen';

function StagingZone() {
  const { state, dispatch } = useGame();
  const [hintSeen, setHintSeen] = useState<boolean | null>(null);
  const staged = state.phase === 'solved' ? state.stagedCards : [];
  const hasCards = staged.length > 0;

  useEffect(() => {
    AsyncStorage.getItem(STAGING_HINT_KEY).then((v) => setHintSeen(v === 'true'));
  }, []);

  useEffect(() => {
    if (hasCards && hintSeen === false) {
      AsyncStorage.setItem(STAGING_HINT_KEY, 'true');
      setHintSeen(true);
    }
  }, [hasCards, hintSeen]);

  if (state.phase !== 'solved' || state.equationResult === null || state.hasPlayedCards || state.pendingFractionTarget !== null) return null;

  const target = state.equationResult!;
  const numberAndWild = staged.filter(c => c.type === 'number' || c.type === 'wild');
  const stOpCard = staged.filter(c => c.type === 'operation')[0] ?? null;
  const hasWild = numberAndWild.some(c => c.type === 'wild');
  const wildVal = hasWild ? computeWildValueInStaged(numberAndWild, stOpCard, target) : null;
  const sum = numberAndWild.reduce((s, c) => s + (c.type === 'number' ? (c.value ?? 0) : (wildVal ?? 0)), 0);
  const matches = hasCards && validateStagedCards(numberAndWild, stOpCard, target);

  const clearAll = () => { staged.forEach(c => dispatch({type:'UNSTAGE_CARD',card:c})); };

  return (
    <View style={szS.wrap}>
      {hasCards && (
        <View style={{alignItems:'center',gap:6}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,direction:'ltr' as any, flexWrap: 'wrap', justifyContent: 'center'}}>
            <Text style={{color:'#9CA3AF',fontSize:13,fontWeight:'600'}}>נבחר:</Text>
            {numberAndWild.map((c, i) => (
              <React.Fragment key={c.id}>
                {i > 0 && <Text style={{color:'#FDD835',fontSize:16,fontWeight:'900'}}>+</Text>}
                <Text style={{color: c.type === 'wild' ? '#A78BFA' : '#FFF',fontSize:16,fontWeight:'900'}}>{c.type === 'wild' ? (wildVal ?? '?') : c.value}</Text>
              </React.Fragment>
            ))}
            <Text style={{color:'#FFD700',fontSize:16,fontWeight:'900'}}>=</Text>
            <Text style={{color: matches ? '#4ADE80' : '#FCA5A5',fontSize:18,fontWeight:'900'}}>{target}</Text>
            {matches && <Text style={{color:'#4ADE80',fontSize:16}}>✓</Text>}
            <TouchableOpacity onPress={clearAll} hitSlop={{top:8,bottom:8,left:8,right:8}} style={szS.undoBtn}>
              <Text style={{color:'#FCA5A5',fontSize:18,fontWeight:'900'}}>↩</Text>
            </TouchableOpacity>
          </View>
          {!matches && hasCards && (
            <Text style={{color:'#FCA5A5',fontSize:12,textAlign:'center'}}>השילוב לא מגיע ל־{target}. נסה לשנות.</Text>
          )}
        </View>
      )}
      {!hasCards && hintSeen === false && <Text style={szS.hint}>לחץ על קלפי מספר או פרא מהיד.</Text>}
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
  const canLol=(pr||bl||so)&&cp.hand.length<=2&&!cp.calledLolos&&state.pendingFractionTarget===null;
  return (
    <View style={{width:'100%',gap:10}}>
      {(pr||bl||so)&&hp && (
        <View style={{alignItems:'center',gap:6}}>
          {!!state.lastMoveMessage && (
            <View style={{backgroundColor:'rgba(74,222,128,0.1)',borderRadius:10,borderWidth:1,borderColor:'rgba(74,222,128,0.3)',paddingHorizontal:14,paddingVertical:6}}>
              <Text style={{color:'#4ADE80',fontSize:13,fontWeight:'700',textAlign:'center'}}>{state.lastMoveMessage}</Text>
            </View>
          )}
          <Text style={{color:'#9CA3AF',fontSize:12,fontWeight:'600'}}>{cp.hand.length} קלפים ביד</Text>
          <LulosButton text="סיים תור" color="green" width={160} height={52} onPress={()=>dispatch({type:'END_TURN'})} />
        </View>
      )}
      {canLol && (
        <View style={{flexDirection:'row',gap:8}}>
          <LulosButton
            text="🏁 כמעט סיימתי!"
            color="yellow"
            width={200}
            height={64}
            fontSize={26}
            onPress={()=>dispatch({type:'CALL_LOLOS'})}
          />
        </View>
      )}
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

function SimpleHand({ cards, stagedCardIds, equationOpCardId, equationOpPlaced, defenseValidCardIds, forwardCardId, onTap, onCenterCard }: {
  cards: Card[];
  stagedCardIds: Set<string>;
  equationOpCardId: string | null;
  equationOpPlaced: boolean;
  defenseValidCardIds: Set<string> | null;
  forwardCardId: string | null;
  onTap: (card: Card) => void;
  onCenterCard?: (card: Card | null) => void;
}) {
  const count = cards.length;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(0);

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

  if (count === 0) return <View style={{ height: 80 }} />;

  const fanH = FAN_CARD_H * FAN_CENTER_SCALE + 55;
  const sp = spacing; // pinch multiplier for translateX + angles

  return (
    <View style={{ width: SCREEN_W, height: fanH, overflow: 'visible' }} {...panResponder.panHandlers}>
      {cards.map((card, i) => {
        const isStaged = stagedCardIds.has(card.id);
        const isEqOp = equationOpCardId === card.id;
        const isDefenseValid = defenseValidCardIds !== null && defenseValidCardIds.has(card.id);
        const isDefenseInvalid = defenseValidCardIds !== null && !defenseValidCardIds.has(card.id);
        const isForward = forwardCardId === card.id;

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
              top: isEqOp && !equationOpPlaced ? 30 : isStaged ? 35 : 20,
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
            {/* Gold glow behind forwardable operation card */}
            {isForward && (
              <View style={{
                position:'absolute', top:-4, left:-4, right:-4, bottom:-4,
                borderRadius:14, borderWidth:2.5, borderColor:'#FFD700',
                opacity: 0.8,
              }} pointerEvents="none" />
            )}
            {isForward && (
              <View style={{position:'absolute',top:-22,left:-10,right:-10,alignItems:'center'}} pointerEvents="none">
                <Text style={{color:'#FFD700',fontSize:9,fontWeight:'900',textAlign:'center'}}>{'⚔️ העבר'}</Text>
              </View>
            )}
            <TouchableOpacity activeOpacity={0.8} onPress={() => onTap(card)} disabled={isDefenseInvalid}>
              <View style={[
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
//  PLAYER HAND
// ═══════════════════════════════════════════════════════════════

function PlayerHand() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex]; if(!cp) return null;
  const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved';
  const td = state.discardPile[state.discardPile.length-1];
  const hasFracDefense = state.pendingFractionTarget !== null;
  const sorted = [...cp.hand].sort((a,b) => { const o={number:0,fraction:1,operation:2,joker:3} as const; if(o[a.type]!==o[b.type]) return o[a.type]-o[b.type]; if(a.type==='number'&&b.type==='number') return (a.value??0)-(b.value??0); return 0; });
  const [centerCard, setCenterCard] = useState<Card | null>(null);
  // Fraction hints handled by bottom sheets in GameScreen

  const tap = (card:Card) => {
    console.log('CARD TAP', card.id, card.type, card.type==='operation'?card.operation:'', 'phase=', state.phase, 'hp=', state.hasPlayedCards, 'activeOp=', state.activeOperation);
    if (state.hasPlayedCards) { console.log('BLOCKED: hasPlayedCards'); return; }

    // ── Fraction defense: only number (divisible) or fraction; ג'וקר לא מגן מפני שבר ──
    if (hasFracDefense) {
      if (card.type === 'number' && card.value && card.value % state.fractionPenalty === 0) {
        dispatch({ type: 'DEFEND_FRACTION_SOLVE', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      // ג'וקר: לא מטפלים — לא מגן מפני התקפת שבר (רק סימן)
      return;
    }

    if (pr) {
      // Forward challenge: tap opposite operation card to transfer
      if (state.activeOperation && card.type === 'operation') {
        const opposite = parallelOp[state.activeOperation];
        if (card.operation === opposite) {
          dispatch({ type: 'FORWARD_CHALLENGE', card });
          return;
        }
      }
      if (card.type === 'fraction') { if (fracTapIntercept.fn && fracTapIntercept.fn(card)) return; dispatch({ type: 'PLAY_FRACTION', card }); return; }
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
      else if (card.type === 'fraction') { if (fracTapIntercept.fn && fracTapIntercept.fn(card)) return; dispatch({ type: 'PLAY_FRACTION', card }); }
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
      else if(card.type==='fraction') { if (fracTapIntercept.fn && fracTapIntercept.fn(card)) return; dispatch({type:'PLAY_FRACTION',card}); }
      else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card});
    }
  };

  const stagedIds = new Set(state.stagedCards.map(c => c.id));

  // Defense highlight: auto-highlight valid cards when fraction challenge active
  const defenseValidIds = hasFracDefense
    ? new Set<string>(sorted.filter(c =>
        (c.type === 'number' && c.value && c.value % state.fractionPenalty === 0) || c.type === 'fraction'
      ).map(c => c.id))
    : null;

  const forwardCardId = (pr && state.activeOperation && !state.hasPlayedCards)
    ? cp.hand.find(c => c.type === 'operation' && c.operation === parallelOp[state.activeOperation!])?.id ?? null
    : null;

  return (
    <View style={{width:'100%',overflow:'visible'}} pointerEvents="box-none">
      <SimpleHand cards={sorted} stagedCardIds={stagedIds} equationOpCardId={state.equationOpCard?.id ?? null} equationOpPlaced={state.equationOpPosition !== null} defenseValidCardIds={defenseValidIds} forwardCardId={forwardCardId} onTap={tap} onCenterCard={setCenterCard} />
    </View>
  );
}

function BottomControlsBar() {
  const { state, dispatch } = useGame();
  const so = state.phase === 'solved';
  const showSolved = so && !state.hasPlayedCards;
  const hasStaged = showSolved && state.stagedCards.length > 0;

  const showBar = showSolved;

  return (
    <View style={{minHeight:40,alignItems:'center',justifyContent:'center',paddingHorizontal:10,backgroundColor: showBar ? 'rgba(15,23,42,0.95)' : 'transparent', borderTopWidth: showBar ? 1 : 0, borderTopColor:'rgba(255,255,255,0.08)'}}>
      {showSolved ? (
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,width:'100%'}}>
          {hasStaged && (
            <LulosButton text="הנח קלפים" color="green" width={140} height={40} fontSize={14} onPress={()=>dispatch({type:'CONFIRM_STAGED'})} style={{flex:1.2}} />
          )}
          <LulosButton text="חזרה לתרגיל" color="yellow" width={140} height={40} fontSize={13} onPress={()=>dispatch({type:'REVERT_TO_BUILDING'})} style={{flex:1}} />
        </View>
      ) : null}
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════
//  START SCREEN
// ═══════════════════════════════════════════════════════════════

// Floating background items data — math symbols + dice, all same white outline style
type FloatItem = { kind: 'sym'; sym: string; left: string; startY: number; size: number; speed: number; drift: number; opacity: number }
              | { kind: 'dice'; face: number; left: string; startY: number; size: number; speed: number; drift: number; opacity: number };

const FLOAT_ITEMS: FloatItem[] = [
  // Operators
  { kind: 'sym', sym: '+', left: '8%', startY: 0.1, size: 28, speed: 1.0, drift: 12, opacity: 0.04 },
  { kind: 'sym', sym: '−', left: '25%', startY: 0.5, size: 22, speed: 1.2, drift: -8, opacity: 0.04 },
  { kind: 'sym', sym: '×', left: '50%', startY: 0.2, size: 32, speed: 0.8, drift: 15, opacity: 0.04 },
  { kind: 'sym', sym: '÷', left: '75%', startY: 0.7, size: 24, speed: 1.1, drift: -10, opacity: 0.04 },
  { kind: 'sym', sym: '+', left: '18%', startY: 0.8, size: 20, speed: 1.3, drift: 6, opacity: 0.04 },
  { kind: 'sym', sym: '−', left: '60%', startY: 0.35, size: 26, speed: 0.9, drift: -14, opacity: 0.04 },
  { kind: 'sym', sym: '×', left: '40%', startY: 0.65, size: 30, speed: 1.0, drift: 10, opacity: 0.04 },
  { kind: 'sym', sym: '÷', left: '88%', startY: 0.45, size: 22, speed: 1.15, drift: -6, opacity: 0.04 },
  // Fractions
  { kind: 'sym', sym: '½', left: '12%', startY: 0.25, size: 26, speed: 0.9, drift: -11, opacity: 0.06 },
  { kind: 'sym', sym: '¾', left: '68%', startY: 0.1, size: 24, speed: 1.05, drift: 8, opacity: 0.06 },
  { kind: 'sym', sym: '⅓', left: '33%', startY: 0.55, size: 28, speed: 0.85, drift: -13, opacity: 0.06 },
  { kind: 'sym', sym: '⅔', left: '80%', startY: 0.3, size: 22, speed: 1.25, drift: 7, opacity: 0.06 },
  { kind: 'sym', sym: '¼', left: '4%', startY: 0.7, size: 30, speed: 0.75, drift: -9, opacity: 0.06 },
  { kind: 'sym', sym: '⅛', left: '45%', startY: 0.85, size: 20, speed: 1.35, drift: 12, opacity: 0.06 },
  { kind: 'sym', sym: '⅝', left: '93%', startY: 0.4, size: 24, speed: 1.1, drift: -7, opacity: 0.06 },
  { kind: 'sym', sym: '⅕', left: '55%', startY: 0.75, size: 26, speed: 0.95, drift: 14, opacity: 0.06 },
  // Dice — same opacity/weight as symbols, colorless white outline
  { kind: 'dice', face: 6, left: '15%', startY: 0.15, size: 28, speed: 0.75, drift: 10,  opacity: 0.04 },
  { kind: 'dice', face: 3, left: '42%', startY: 0.6,  size: 22, speed: 1.1,  drift: -12, opacity: 0.04 },
  { kind: 'dice', face: 5, left: '72%', startY: 0.32, size: 26, speed: 0.85, drift: 14,  opacity: 0.05 },
  { kind: 'dice', face: 1, left: '90%', startY: 0.78, size: 20, speed: 1.2,  drift: -8,  opacity: 0.04 },
  { kind: 'dice', face: 4, left: '5%',  startY: 0.48, size: 24, speed: 0.95, drift: 11,  opacity: 0.05 },
  { kind: 'dice', face: 2, left: '58%', startY: 0.88, size: 30, speed: 0.7,  drift: -14, opacity: 0.04 },
  { kind: 'dice', face: 5, left: '32%', startY: 0.05, size: 20, speed: 1.25, drift: 7,   opacity: 0.04 },
  { kind: 'dice', face: 3, left: '82%', startY: 0.52, size: 24, speed: 0.9,  drift: -10, opacity: 0.05 },
];

// Pip positions for die face SVG (fraction of size, 0-1)
const FLOAT_PIP_POS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.7], [0.7, 0.3]],
  3: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

// Outline-only SVG die — white strokes, no fill, matches text symbol style
function FloatingDieSvg({ size, face, color }: { size: number; face: number; color: string }) {
  const pips = FLOAT_PIP_POS[face] || FLOAT_PIP_POS[1];
  const pipR = size * 0.07;
  const sw = size * 0.07; // stroke weight scales with size like font weight
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgRect
        x={sw / 2} y={sw / 2}
        width={size - sw} height={size - sw}
        rx={size * 0.18} ry={size * 0.18}
        fill="none" stroke={color} strokeWidth={sw}
      />
      {pips.map(([px, py], i) => (
        <SvgCircle
          key={i}
          cx={px * size} cy={py * size} r={pipR}
          fill={color} stroke="none"
        />
      ))}
    </Svg>
  );
}

function FloatingMathBackground() {
  const floatAnims = useRef(FLOAT_ITEMS.map(() => new Animated.Value(0))).current;
  const swayAnims = useRef(FLOAT_ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    FLOAT_ITEMS.forEach((item, i) => {
      const startPos = SCREEN_H * item.startY;
      floatAnims[i].setValue(startPos);
      const fullDur = (10000 + i * 1200) / item.speed;
      const firstDur = fullDur * ((startPos + 80) / (SCREEN_H + 80));

      Animated.timing(floatAnims[i], {
        toValue: -80, duration: firstDur, useNativeDriver: true,
      }).start(() => {
        floatAnims[i].setValue(SCREEN_H);
        Animated.loop(
          Animated.timing(floatAnims[i], { toValue: -80, duration: fullDur, useNativeDriver: true })
        ).start();
      });

      Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnims[i], { toValue: item.drift, duration: 2500 + i * 300, useNativeDriver: true }),
          Animated.timing(swayAnims[i], { toValue: -item.drift, duration: 2500 + i * 300, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FLOAT_ITEMS.map((item, i) => {
        const color = `rgba(255,255,255,${item.opacity})`;
        if (item.kind === 'sym') {
          return (
            <Animated.Text
              key={`sym-${i}`}
              style={{
                position: 'absolute', left: item.left as any,
                fontSize: item.size, fontWeight: '900',
                color,
                transform: [
                  { translateY: floatAnims[i] },
                  { translateX: swayAnims[i] },
                ],
              }}
            >
              {item.sym}
            </Animated.Text>
          );
        }
        return (
          <Animated.View
            key={`dice-${i}`}
            style={{
              position: 'absolute', left: item.left as any,
              transform: [
                { translateY: floatAnims[i] },
                { translateX: swayAnims[i] },
              ],
            }}
          >
            <FloatingDieSvg size={item.size} face={item.face} color={color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function ConditionalFloatingBg() {
  const { state } = useGame();
  if (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') return null;
  return <FloatingMathBackground />;
}

function ConditionalWalkingDice() {
  const { state } = useGame();
  // GameScreen has its own WalkingDice inside ImageBackground, so skip here
  if (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') return null;
  return <WalkingDice />;
}

function StartScreen() {
  const { dispatch } = useGame();
  const safe = useGameSafeArea();
  const [playerCount, setPlayerCount] = useState(2);
  const [numberRange, setNumberRange] = useState<'easy' | 'full'>('full');
  const [fractions, setFractions] = useState(true);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [timer, setTimer] = useState<'30' | '45' | 'off'>('off');
  const [guidanceOn, setGuidanceOn] = useState(true); // הדרכה והסברים — משתמש חוזר יכול לכבות
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cardsCatalogOpen, setCardsCatalogOpen] = useState(false);
  const [diceMode, setDiceMode] = useState<'2' | '3'>('3');
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('lulos_guidance_enabled').then(v => setGuidanceOn(v !== 'false'));
  }, []);
  const setGuidance = (on: boolean) => {
    setGuidanceOn(on);
    AsyncStorage.setItem('lulos_guidance_enabled', on ? 'true' : 'false');
  };

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
    // שמות יוכנסו במסך השחקן — כל שחקן מזין את שמו בתורו
    const players = Array.from({ length: playerCount }, (_, i) => ({ name: `שחקן ${i + 1}` }));
    dispatch({ type: 'START_GAME', players, difficulty: numberRange, diceMode, fractions, showPossibleResults, timerSetting: timer });
  };

  // תחתית מסע — תפריט קומפקטי כדי שהג'וקר (פנים/מותג) יופיע במלואו
  const MENU_H = 160;
  const bottomPad = safe.SAFE_BOTTOM_PAD || 12;
  const PLAY_BTN_H = 56;
  const totalBottomH = MENU_H + PLAY_BTN_H + bottomPad;
  // תמונת ג'וקר — גודל קבוע קטן יותר כדי שהתמונה תופיע במלואה (פנים המשחק, המותג)
  const JOKER_SIZE = Math.min(SCREEN_W * 0.52, 220);

  return (
    <View style={{ flex: 1 }}>
      {/* כפתור חוקים — בצד למעלה */}
      <View style={{ position: 'absolute', top: safe.insets.top || 12, right: 16, zIndex: 20 }}>
        <LulosButton text="חוקים" color="blue" width={72} height={32} fontSize={11} onPress={() => setRulesOpen(true)} />
      </View>
      <AppModal visible={rulesOpen} onClose={() => setRulesOpen(false)} title="איך משחקים — מסך כללים">
        <RulesContent state={null} numberRange={numberRange} fractions={fractions} onOpenCardsCatalog={() => { setRulesOpen(false); setCardsCatalogOpen(true); }} />
      </AppModal>
      <AppModal visible={cardsCatalogOpen} onClose={() => setCardsCatalogOpen(false)} title="פירוט קלפים במשחק">
        <CardsCatalogContent numberRange={numberRange} fractions={fractions} />
      </AppModal>
      {/* קבלת פנים */}
      <View style={{ alignItems: 'center', paddingTop: 8, paddingHorizontal: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>👋 ברוכים הבאים!</Text>
      </View>
      {/* ג'וקר — במלוא המסך */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginBottom: totalBottomH }}>
        <Animated.View style={{
          transform: [{ translateY: bounceAnim }],
          width: JOKER_SIZE,
          height: JOKER_SIZE,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 24 },
            android: { elevation: 12 },
          }),
        }}>
          <Image source={require('./assets/joker.jpg')} style={{ width: JOKER_SIZE, height: JOKER_SIZE }} resizeMode="contain" />
        </Animated.View>
      </View>

      {/* Bottom menu — קומפקטי כדי שהג'וקר יופיע במלואו */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '50%', paddingHorizontal: 20, paddingBottom: bottomPad, backgroundColor: '#0a1628', zIndex: 10 }}>
        <ScrollView style={{ maxHeight: '100%' }} contentContainerStyle={{ paddingTop: 8 }} showsVerticalScrollIndicator={true} bounces={false}>
        <View style={hsS.settings}>
          {/* מספר שחקנים — בראש הרשימה */}
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

          {/* הדרכה והסברים — כבוי למשתמש חוזר שלא רוצה הסברים */}
          <View style={hsS.row}>
            <Text style={hsS.rowLabel}>הדרכה והסברים</Text>
            <View style={hsS.toggleGroup}>
              {([[true, 'מופעל'], [false, 'כבוי']] as const).map(([key, label]) => (
                <TouchableOpacity key={String(key)} onPress={() => setGuidance(key)} activeOpacity={0.7}
                  style={[hsS.toggleBtn, guidanceOn === key ? hsS.toggleOn : hsS.toggleOff]}>
                  <Text style={guidanceOn === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        </ScrollView>
        {/* Start button — למטה, נפרד מהתפריט (כפתור חוקים רק למעלה) */}
        <View style={{ marginTop: 12, alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <CasinoButton text="בואו נשחק" width={220} height={48} fontSize={19} onPress={startGame} />
        </View>
        <TouchableOpacity
          onLongPress={() => {
            const allKeys = [...ONB_KEYS, ...GUIDANCE_KEYS, 'lulos_tutorial_done', 'lulos_tip1_done', 'lulos_tip2_done', 'lulos_frac_arrow_seen', 'lulos_ident_arrow_seen', 'onb_first_discard', 'onb_welcome_screen', 'lulos_welcome_player_screen_seen'];
            Promise.all(allKeys.map(k => AsyncStorage.removeItem(k))).then(() => {
              console.log('[DEV] Cleared all onboarding keys:', allKeys);
              alert('Onboarding reset! Restart the game to see onboarding again.');
            });
          }}
          activeOpacity={0.5}
          delayLongPress={2000}
        >
          <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, textAlign: 'center', marginTop: 6 }}>v1.0.0</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const hsS = StyleSheet.create({
  // Joker area — flex:1 fills space between top and bottom menu
  jokerArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
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

// מפתח ישן — נשאר ברשימת האיפוס בלבד (לא בשימוש: התראה פעם per משחק, לפי הדרכה)
const WELCOME_PLAYER_KEY = 'lulos_welcome_player_screen_seen';

function TurnTransition() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  const currentIdx = state.currentPlayerIndex;
  const [tooltipCard, setTooltipCard] = useState<Card | null>(null);
  // הצגת הדרכה מיד בכניסה למסך השחקן (סיבוב ראשון) — מסתירים רק אם בדף הכניסה כיבו "הדרכה והסברים"
  const [showWelcome, setShowWelcome] = useState<boolean>(() => state.roundsPlayed === 0);
  const emptySet = useMemo(() => new Set<string>(), []);

  useEffect(() => {
    if (state.roundsPlayed !== 0) {
      setShowWelcome(false);
      return;
    }
    AsyncStorage.getItem('lulos_guidance_enabled').then((v) => {
      if (v === 'false') setShowWelcome(false);
    });
  }, [state.roundsPlayed]);

  // Deal sound — מופעל בכניסה למסך השחקן כדי לתת תחושת \"חילקו את היד\"
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentMode: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(require('./assets/possible_results_sound.mov'));
        if (!mounted) {
          await sound.unloadAsync();
          return;
        }
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s.didJustFinish || (s as any).didJustFinishNotify) {
            sound.unloadAsync();
          }
        });
      } catch {
        // ignore sound errors
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dismissWelcome = () => setShowWelcome(false);

  if (!cp) return null;

  const updateName = (name: string) => dispatch({ type: 'UPDATE_PLAYER_NAME', playerIndex: currentIdx, name });

  // Sort cards identically to PlayerHand
  const sorted = [...cp.hand].sort((a,b) => { const o={number:0,fraction:1,operation:2,joker:3} as const; if(o[a.type]!==o[b.type]) return o[a.type]-o[b.type]; if(a.type==='number'&&b.type==='number') return (a.value??0)-(b.value??0); return 0; });

  const getCardTooltip = (card: Card): string => {
    switch (card.type) {
      case 'number': return `קלף מספר (${card.value}) — הנח אותו בתרגיל כדי לפתור את המשוואה`;
      case 'fraction': {
        const fracTips: Record<string, string> = {
          '1/2': 'קלף שבר — מחלק את היעד ב-2. יעד 10 הופך ל-5. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
          '1/3': 'קלף שבר — מחלק את היעד ב-3. יעד 9 הופך ל-3. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
          '1/4': 'קלף שבר — מחלק את היעד ב-4. יעד 12 הופך ל-3. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
          '1/5': 'קלף שבר — מחלק את היעד ב-5. יעד 10 הופך ל-2. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
        };
        return fracTips[card.fraction] ?? `קלף שבר (${card.fraction}). גם קלף התקפה — הנח על הערימה כדי לאתגר את השחקן הבא.`;
      }
      case 'operation': return `קלף פעולה (${card.operation}) — הנח אותו בתרגיל כדי לאתגר את השחקן הבא!`;
      case 'joker': return `ג'וקר — תחליף לסימן (+, −, ×, ÷). מגן רק מפני התקפת סימן, לא מפני התקפת שבר.`;
      case 'wild': return `קלף פרא — נספר ככל מספר 0–25. הנח בתרגיל או זהה לערימה כדי להיפטר ממנו.`;
      default: return '';
    }
  };

  const safe = useSafeAreaInsets();
  const HEADER_PAD = 44;
  const BTN_STRIP_H = 80;
  return (
    <View style={{flex:1,paddingTop:HEADER_PAD,paddingBottom:safe.bottom,overflow:'hidden'}} collapsable={false}>
      {/* ── Header — יציאה למעלה בצד אחד, קלפים/טיימר/שברים בצד הנגדי ── */}
      <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:12,paddingVertical:6}}>
        <View style={{flexDirection:'column',alignItems:'flex-end',gap:2}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <View style={{backgroundColor:'rgba(59,130,246,0.25)',borderRadius:8,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:'#93C5FD'}}>
              <Text style={{color:'#BFDBFE',fontSize:11,fontWeight:'700'}}>{cp?.hand.length} קלפים</Text>
            </View>
            <View style={{backgroundColor:'rgba(234,179,8,0.2)',borderRadius:8,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:'#FACC15'}}>
              <Text style={{color:'#FDE68A',fontSize:11,fontWeight:'700'}}>{state.timerSetting === 'off' ? 'ללא טיימר' : `${state.timerSetting} שנ׳`}</Text>
            </View>
            {state.showFractions && (
              <View style={{backgroundColor:'rgba(34,197,94,0.2)',borderRadius:8,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:'#4ADE80'}}>
                <Text style={{color:'#86EFAC',fontSize:11,fontWeight:'700'}}>שברים</Text>
              </View>
            )}
          </View>
          <View style={{backgroundColor:'rgba(34,197,94,0.3)',borderRadius:8,paddingHorizontal:10,paddingVertical:4,borderWidth:1.5,borderColor:'#4ADE80'}}>
            <Text style={{color:'#86EFAC',fontSize:11,fontWeight:'800'}} numberOfLines={1}>{cp.name || 'שחקן'}</Text>
          </View>
        </View>
        <View style={{flexShrink:0}}>
          <LulosButton text="יציאה" color="red" width={72} height={32} fontSize={11} onPress={()=>dispatch({type:'RESET_GAME'})} />
        </View>
      </View>

      <View style={{flex:1,paddingBottom:BTN_STRIP_H + HAND_STRIP_HEIGHT,overflow:'hidden'}}>
      {/* ── הכנסת שם — שדה ריק עם placeholder בלבד ── */}
      <View style={{paddingHorizontal:20,paddingVertical:8}}>
        <TextInput
          value={/^שחקן \d+$/.test(cp.name) ? '' : cp.name}
          onChangeText={updateName}
          placeholder="מלא את שמך"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={{
            backgroundColor: 'rgba(15,23,42,0.95)',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: 'rgba(255,215,0,0.4)',
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: '#FFF',
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
          }}
        />
      </View>

      {/* ── מידע — הודעות וטולטיפ (תגיות הועברו ל־Header) ── */}
      <View style={{flex:1,minHeight:60,paddingHorizontal:24,alignItems:'center',justifyContent:'center'}}>
        {/* Last move summary — הודעות צבעוניות */}
        {!!state.lastMoveMessage && (
          state.pendingFractionTarget !== null ? (
            <View style={{backgroundColor:'rgba(15,23,42,0.95)',borderRadius:16,paddingHorizontal:20,paddingVertical:14,borderWidth:2,borderColor:'#F87171',maxWidth:340,width:'100%',marginBottom:8}}>
              <Text style={{color:'#FCA5A5',fontSize:16,fontWeight:'900',textAlign:'center',marginBottom:10}}>{state.lastMoveMessage}</Text>
              <Text style={{color:'#E2E8F0',fontSize:13,fontWeight:'700',textAlign:'right',lineHeight:22}}>יש לך 3 אפשרויות:</Text>
              <Text style={{color:'#4ADE80',fontSize:13,fontWeight:'600',textAlign:'right',lineHeight:22}}>🛡️ הגנה — הנח קלף שמתחלק ב-{state.fractionPenalty}</Text>
              <Text style={{color:'#FDE68A',fontSize:13,fontWeight:'600',textAlign:'right',lineHeight:22}}>⚔️ התקפה נגדית — הנח שבר נוסף (האתגר עובר הלאה!)</Text>
              <Text style={{color:'#FCA5A5',fontSize:13,fontWeight:'600',textAlign:'right',lineHeight:22}}>😔 אין הגנה? שלוף {state.fractionPenalty} קלפי עונש</Text>
              <Text style={{color:'rgba(255,255,255,0.55)',fontSize:11,fontWeight:'600',textAlign:'right',lineHeight:18,marginTop:6}}>⚠️ ג׳וקר לא מגן מפני שבר — רק מספר שמתחלק או שבר.</Text>
            </View>
          ) : (
            <View style={{flexDirection:'row',alignItems:'center',gap:8,alignSelf:'center',marginBottom:8,maxWidth:340,width:'100%',justifyContent:'center'}}>
              <View style={alertBubbleStyle.box}>
                {(() => {
                  const msg = state.lastMoveMessage!;
                  const sep = msg.indexOf(' — ');
                  const title = sep >= 0 ? msg.slice(0, sep) : msg;
                  const body = sep >= 0 ? msg.slice(sep + 3) : '';
                  return (
                    <>
                      <Text style={alertBubbleStyle.title}>{title}</Text>
                      {!!body && <Text style={alertBubbleStyle.body}>{body}</Text>}
                    </>
                  );
                })()}
              </View>
              <GoldArrow direction="right" size={48} />
            </View>
          )
        )}

        {/* Card tooltip — צבעוני (מסגרת זהב, טקסט צהוב) */}
        {tooltipCard && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setTooltipCard(null)} style={{backgroundColor:'rgba(30,41,59,0.98)',borderRadius:16,paddingHorizontal:22,paddingVertical:18,borderWidth:2,borderColor:'#FACC15',maxWidth:340,width:'100%',marginBottom:8}}>
            <Text style={{color:'#FDE68A',fontSize:17,fontWeight:'700',textAlign:'center',lineHeight:26}}>{getCardTooltip(tooltipCard)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── מניפה: מקום קבוע בתחתית, מעל "אני מוכן" (לפי בקשת קבע) ── */}
      <View style={{position:'absolute',bottom:BTN_STRIP_H + safe.bottom,left:0,right:0,height:220,zIndex:5,alignItems:'center',justifyContent:'flex-end',paddingHorizontal:12}}>
        <Text style={{color:'#FACC15',fontSize:14,fontWeight:'800',textAlign:'center',marginBottom:6,textShadowColor:'rgba(0,0,0,0.5)',textShadowOffset:{width:0,height:1},textShadowRadius:4}}>
          👆 לחץ על הקלפים
        </Text>
        <View style={{height:200,width:'100%',alignItems:'center'}}>
          <SimpleHand
            cards={sorted}
            stagedCardIds={emptySet}
            equationOpCardId={null}
            equationOpPlaced={false}
            defenseValidCardIds={null}
            forwardCardId={null}
            onTap={(card) => setTooltipCard(prev => prev?.id === card.id ? null : card)}
          />
        </View>
      </View>

      {/* ── "אני מוכן" — מקום קבוע בתחתית, בלי גלילה ובלי קפיצות ── */}
      <View style={{position:'absolute',bottom:0,left:0,right:0,height:BTN_STRIP_H,paddingBottom:safe.bottom,alignItems:'center',justifyContent:'center',zIndex:10}}>
        <CasinoButton text="אני מוכן" width={220} height={48} fontSize={19} onPress={()=>dispatch({type:'BEGIN_TURN'})} />
      </View>
      </View>

      {/* ── ברוכים הבאים — overlay תמיד גלוי מעל הכל ── */}
      {showWelcome && !tooltipCard && (
        <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',zIndex:200,elevation:200,justifyContent:'center',alignItems:'center',paddingHorizontal:24}}>
          <View style={{backgroundColor:'rgba(30,41,59,0.98)',borderRadius:16,paddingHorizontal:20,paddingVertical:16,borderWidth:2,borderColor:'#FACC15',maxWidth:340,width:'100%'}}>
            <Text style={{color:'#FDE68A',fontSize:18,fontWeight:'800',textAlign:'center',marginBottom:10}}>👋 ברוכים/ות למשחק!</Text>
            <Text style={{color:'#E2E8F0',fontSize:14,fontWeight:'600',textAlign:'center',lineHeight:22,marginBottom:14}}>
              זה התור שלך. מלא/י את שמך למעלה (פעם אחת), הכר את הקלפים, ולחץ/י "אני מוכן" כשאת/ה מוכן/ה להתחיל.
            </Text>
            <CasinoButton text="הבנתי" width={160} height={44} onPress={dismissWelcome} />
          </View>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAME SCREEN
// ═══════════════════════════════════════════════════════════════

function PlayerSidebar({ secsLeft, timerTotal, timerRunning }: { secsLeft?: number; timerTotal?: number; timerRunning?: boolean }) {
  const { state } = useGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cardsCatalogOpen, setCardsCatalogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const sorted = [...state.players].sort((a, b) => a.hand.length - b.hand.length);
  const visible = showAll ? sorted : sorted.slice(0, 3);
  const hasMore = sorted.length > 3 && !showAll;
  const cp = state.players[state.currentPlayerIndex];

  return (
    <>
      <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:0,flexWrap:'nowrap'}}>
        {visible.map((p) => {
          const isCurrent = cp?.id === p.id;
          const shortName = p.name.length > 5 ? p.name.slice(0, 4) + '…' : p.name;
          return (
            <LulosButton
              key={p.id}
              text={`${shortName} ${p.hand.length}`}
              color={isCurrent ? 'green' : 'blue'}
              width={72}
              height={32}
              fontSize={10}
              onPress={() => {}}
            />
          );
        })}
        {hasMore && (
          <TouchableOpacity onPress={() => setShowAll(true)} style={{marginRight:4,width:28,height:28,borderRadius:14,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'}}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#FFF'}}>+</Text>
          </TouchableOpacity>
        )}
        {timerTotal != null && state.timerSetting !== 'off' && (
          <View style={{flexDirection:'row',alignItems:'center',gap:4,marginRight:8}}>
            <Text style={{color:'rgba(255,255,255,0.9)',fontSize:12,fontWeight:'700'}}>⏱ {secsLeft ?? 0}</Text>
          </View>
        )}
        {cp && (
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <Text style={{color:'rgba(255,255,255,0.9)',fontSize:12,fontWeight:'700'}}>🃏 {cp.hand.length}</Text>
          </View>
        )}
      </View>
      <View style={{flexShrink:0}}>
        <LulosButton text="חוקים" color="blue" width={72} height={32} fontSize={11} onPress={() => setRulesOpen(true)} />
      </View>
      <AppModal visible={rulesOpen} onClose={() => setRulesOpen(false)} title="איך משחקים — מסך כללים">
        <RulesContent state={state} numberRange={state.difficulty} fractions={state.showFractions} onOpenCardsCatalog={() => { setRulesOpen(false); setCardsCatalogOpen(true); }} />
      </AppModal>
      <AppModal visible={cardsCatalogOpen} onClose={() => setCardsCatalogOpen(false)} title="פירוט קלפים במשחק">
        <CardsCatalogContent numberRange={state.difficulty} fractions={state.showFractions} />
      </AppModal>
    </>
  );
}
const sbS = StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:3,flex:1},
  badge:{flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'rgba(255,255,255,0.1)',paddingHorizontal:6,paddingVertical:2,borderRadius:5},
  badgeActive:{backgroundColor:'#2196F3'},
  badgeName:{color:'rgba(255,255,255,0.4)',fontSize:9,fontWeight:'700',maxWidth:48},
  badgeNameActive:{color:'#FFF'},
  badgeCount:{color:'rgba(255,255,255,0.3)',fontSize:9,fontWeight:'700'},
  badgeCountActive:{color:'#E3F2FD'},
});

function FlashingRollButton({ onPress }: { onPress: () => void }) {
  return <GoldDiceButton onPress={onPress} size={56} />;
}

const ONB_KEYS = ['onb_game_start', 'onb_fraction', 'onb_results', 'onb_forward', 'onb_first_discard', 'onb_welcome_screen'] as const;
type OnbKey = typeof ONB_KEYS[number];

const GUIDANCE_KEYS = ['guidance_fraction', 'guidance_op_challenge', 'guidance_identical', 'guidance_joker', 'guidance_triple'] as const;
type GuidanceKey = typeof GUIDANCE_KEYS[number];

function GameScreen() {
  const { state, dispatch } = useGame();
  const safe = useGameSafeArea();
  const cp = state.players[state.currentPlayerIndex];
  const [showCel,setShowCel] = useState(false);
  const [eqConfirm, setEqConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const [eqResult, setEqResult] = useState<{ result: number | null; ok: boolean; hasError: boolean } | null>(null);
  const prevJ = useRef(state.jokerModalOpen);
  useEffect(() => { if(prevJ.current&&!state.jokerModalOpen&&state.hasPlayedCards) setShowCel(true); prevJ.current=state.jokerModalOpen; }, [state.jokerModalOpen,state.hasPlayedCards]);

  // Background roaming dice
  const bgDiceRef = useRef<RoamingDiceRef>(null);
  const prevDice = useRef(state.dice);
  useEffect(() => {
    if (!prevDice.current && state.dice) bgDiceRef.current?.scatter();
    prevDice.current = state.dice;
  }, [state.dice]);

  // ── Timer countdown ──
  const [secsLeft, setSecsLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const TIMER_TOTAL = state.timerSetting === '30' ? 30 : 45;

  useEffect(() => {
    if (state.timerSetting === 'off') {
      setTimerRunning(false);
      return;
    }
    if (state.phase === 'building') {
      setSecsLeft(TIMER_TOTAL);
      setTimerRunning(true);
    } else if (state.phase !== 'solved') {
      setTimerRunning(false);
    }
  }, [state.phase]);

  useEffect(() => {
    if (!timerRunning || secsLeft <= 0) return;
    const id = setInterval(() => {
      setSecsLeft(prev => {
        if (prev <= 1) {
          setTimerRunning(false);
          dispatch({ type: 'DRAW_CARD' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, secsLeft <= 0]);

  // Operation challenge sheet dismiss state

  // Feedback notification moved to TurnTransition screen

  // צליל הטלת קוביות — רק אם קיים dice_sound.mov; בלי צליל אחר כגיבוי
  const playDiceSound = useCallback(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentMode: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/dice_sound.mov'));
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((s: { didJustFinish?: boolean; didJustFinishNotify?: boolean }) => {
          if ((s as any).didJustFinish || s.didJustFinishNotify) sound.unloadAsync().catch(() => {});
        });
      } catch (_) {
        // אין צליל קוביות — לא משמיעים צליל אחר
      }
    })();
  }, []);

  // Roll button logic
  const canRoll = state.phase === 'pre-roll' && !state.hasPlayedCards && state.pendingFractionTarget === null;
  const handleRoll = useCallback(() => {
    playDiceSound();
    bgDiceRef.current?.summon();
    const d = rollDiceUtil();
    dispatch({ type: 'ROLL_DICE', values: d });
  }, [dispatch, playDiceSound]);

  // Detect if current player has an identical card they can play
  const td = state.discardPile[state.discardPile.length - 1];

  // ── Tutorial system (first game only) ──
  const [tutStep, setTutStep] = useState(0); // 0=loading, 1=tip1, 2=tip2, 3=tip3, 4=done
  const [tutLoaded, setTutLoaded] = useState(false);
  const tutY = useRef(new Animated.Value(300)).current;

  // Fraction arrow — only first time ever
  const [fracArrowSeen, setFracArrowSeen] = useState(true); // default true = hidden until loaded
  const fracArrowX = useRef(new Animated.Value(0)).current;

  // Identical card arrow hint — only first time ever
  const [identArrowSeen, setIdentArrowSeen] = useState(true);
  const [identArrowVisible, setIdentArrowVisible] = useState(false);
  const identArrowX = useRef(new Animated.Value(0)).current;
  const identArrowLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Contextual onboarding system ──
  const onbSeen = useRef(new Set<string>());
  const onbShownThisRender = useRef(new Set<string>());

  // ── Guidance notification system (first-time full, then short) ──
  const guidanceSeen = useRef(new Set<string>());

  const showOnb = useCallback((key: OnbKey, emoji: string, title: string, body: string) => {
    console.log('[ONB] showOnb called:', key, 'alreadySeen:', onbSeen.current.has(key), 'shownThisRender:', onbShownThisRender.current.has(key));
    if (onbSeen.current.has(key) || onbShownThisRender.current.has(key)) return;
    onbShownThisRender.current.add(key);
    onbSeen.current.add(key);
    AsyncStorage.setItem(key, 'true');
    dispatch({ type: 'PUSH_NOTIFICATION', payload: {
      id: `onb-${key}`,
      message: '',
      emoji,
      title,
      body,
      style: 'info',
      autoDismissMs: 6000,
    }});
  }, [dispatch]);

  const guidanceEnabledRef = useRef(true);
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('lulos_guidance_enabled'),
      AsyncStorage.getItem('lulos_tutorial_done'),
      AsyncStorage.getItem('lulos_tip1_done'),
      AsyncStorage.getItem('lulos_tip2_done'),
      AsyncStorage.getItem('lulos_frac_arrow_seen'),
      AsyncStorage.getItem('lulos_ident_arrow_seen'),
      ...ONB_KEYS.map(k => AsyncStorage.getItem(k)),
      ...GUIDANCE_KEYS.map(k => AsyncStorage.getItem(k)),
    ]).then(([guidance, tut, tip1, tip2, arrow, identArrow, ...rest]) => {
      guidanceEnabledRef.current = guidance !== 'false';
      const onbResults = rest.slice(0, ONB_KEYS.length);
      const guidanceResults = rest.slice(ONB_KEYS.length);
      let step = guidanceEnabledRef.current ? 1 : 4;
      if (tut === 'true') step = 4;
      else if (guidance !== 'false') { if (tip2 === 'true') step = 3; else if (tip1 === 'true') step = 2; }
      setTutStep(step);
      setFracArrowSeen(arrow === 'true' || guidance === 'false');
      setIdentArrowSeen(identArrow === 'true' || guidance === 'false');
      if (guidance === 'false') {
        ONB_KEYS.forEach(k => onbSeen.current.add(k));
        GUIDANCE_KEYS.forEach(k => guidanceSeen.current.add(k));
      } else {
        ONB_KEYS.forEach((k, i) => { if (onbResults[i] === 'true') onbSeen.current.add(k); });
        GUIDANCE_KEYS.forEach((k, i) => { if (guidanceResults[i] === 'true') guidanceSeen.current.add(k); });
      }
      setTutLoaded(true);
    });
  }, []);

  const [tutVisible, setTutVisible] = useState(false);
  const showTut = () => {
    setTutVisible(true);
    tutY.setValue(300);
    Animated.spring(tutY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };
  const dismissTut = () => {
    Animated.timing(tutY, { toValue: 300, duration: 250, useNativeDriver: true }).start(() => {
      setTutVisible(false);
      setTutStep(prev => {
        const next = prev + 1;
        if (prev === 1) AsyncStorage.setItem('lulos_tip1_done', 'true');
        if (prev === 2) AsyncStorage.setItem('lulos_tip2_done', 'true');
        if (next >= 4) AsyncStorage.setItem('lulos_tutorial_done', 'true');
        return next;
      });
    });
  };

  // TIP 1: first pre-roll phase (רק כשהדרכה מופעלת)
  const tutTip1Shown = useRef(false);
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || tutStep !== 1 || state.phase !== 'pre-roll' || tutTip1Shown.current) return;
    tutTip1Shown.current = true;
    showTut();
  }, [tutLoaded, tutStep, state.phase]);

  // TIP 2: after TIP 1 (רק כשהדרכה מופעלת)
  const tutTip2Shown = useRef(false);
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || tutStep !== 2 || (state.phase !== 'pre-roll' && state.phase !== 'building') || tutTip2Shown.current) return;
    tutTip2Shown.current = true;
    showTut();
  }, [tutLoaded, tutStep, state.phase]);

  const tutTip3Shown = useRef(false);

  // Fraction hint state — all declared together before effects that use them
  const fracHintShown = useRef(false);
  const [fracHintVisible, setFracHintVisible] = useState(false);
  const [fracHintRecall, setFracHintRecall] = useState(false);
  const fracHintY = useRef(new Animated.Value(200)).current;
  useEffect(() => { if (state.phase === 'pre-roll') { fracHintShown.current = false; setFracHintRecall(false); } }, [state.phase]);

  // Fraction tap intercept: show hint if playable, toast if not, TIP 3 if tutorial active
  useEffect(() => {
    fracTapIntercept.fn = (card: Card) => {
      const topCard = state.discardPile[state.discardPile.length - 1];
      const playable = validateFractionPlay(card, topCard);

      // TIP 3: tutorial intercept — רק כשהדרכה מופעלת
      if (guidanceEnabledRef.current && tutLoaded && tutStep === 3 && !tutTip3Shown.current) {
        tutTip3Shown.current = true;
        fracHintShown.current = true;
        showTut();
        return true;
      }

      if (!playable) {
        dispatch({ type: 'PUSH_NOTIFICATION', payload: {
          id: `frac-${Date.now()}`,
          message: '😊 הקלף הזה לא מתאים כאן — נסה קלף אחר!',
          style: 'warning',
          autoDismissMs: 2000,
        }});
        return true;
      }

      // Playable + hint not yet shown this turn → show hint before playing (רק כשהדרכה מופעלת)
      if (guidanceEnabledRef.current && !fracHintShown.current) {
        fracHintShown.current = true;
        setFracHintVisible(true);
        setFracHintRecall(false);
        fracHintY.setValue(200);
        Animated.spring(fracHintY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        if (!fracArrowSeen) {
          Animated.loop(Animated.sequence([
            Animated.timing(fracArrowX, { toValue: 8, duration: 500, useNativeDriver: true }),
            Animated.timing(fracArrowX, { toValue: 0, duration: 500, useNativeDriver: true }),
          ])).start();
        }
        return true; // intercepted — don't play yet
      }

      // Hint already shown → let it through to dispatch PLAY_FRACTION
      return false;
    };
    return () => { fracTapIntercept.fn = null; };
  }, [state.discardPile, tutLoaded, tutStep, fracArrowSeen]);

  // Clear recall button when turn ends or phase leaves building/solved
  useEffect(() => {
    if (state.phase !== 'building' && state.phase !== 'solved' && state.phase !== 'pre-roll') {
      setFracHintRecall(false);
      setFracHintVisible(false);
    }
  }, [state.phase]);

  const dismissFracHint = useCallback(() => {
    Animated.timing(fracHintY, { toValue: 200, duration: 300, useNativeDriver: true }).start(() => {
      setFracHintVisible(false);
      setFracHintRecall(true);
      if (!fracArrowSeen) { fracArrowX.stopAnimation(); setFracArrowSeen(true); AsyncStorage.setItem('lulos_frac_arrow_seen', 'true'); }
    });
  }, [fracArrowSeen]);

  const recallFracHint = useCallback(() => {
    setFracHintVisible(true);
    setFracHintRecall(false);
    fracHintY.setValue(200);
    Animated.spring(fracHintY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, []);

  // Auto-dismiss fraction hint after 5 seconds
  const fracHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (fracHintVisible) {
      fracHintTimerRef.current = setTimeout(() => dismissFracHint(), 5000);
    } else if (fracHintTimerRef.current) {
      clearTimeout(fracHintTimerRef.current);
      fracHintTimerRef.current = null;
    }
    return () => { if (fracHintTimerRef.current) clearTimeout(fracHintTimerRef.current); };
  }, [fracHintVisible, dismissFracHint]);

  // Possible results toggle: לחיצה ראשונה — הצגת מיני קלפים, לחיצה שנייה — הסתרה
  const [resultsOpen, setResultsOpenState] = useState(false);
  const toggleResultsBadges = () => setResultsOpenState(prev => !prev);

  // Challenge sheet dismiss state
  const [challengeMinimized, setChallengeMinimized] = useState(false);
  useEffect(() => { if (state.pendingFractionTarget !== null) setChallengeMinimized(false); }, [state.pendingFractionTarget]);

  // Operation challenge sheet — shows when player enters turn with activeOperation
  const [opChallengeVisible, setOpChallengeVisible] = useState(false);
  const opChallengeY = useRef(new Animated.Value(400)).current;
  const prevPhaseForOpChallenge = useRef(state.phase);
  useEffect(() => {
    if (prevPhaseForOpChallenge.current === 'turn-transition' && state.phase === 'pre-roll' && state.activeOperation) {
      setOpChallengeVisible(true);
      opChallengeY.setValue(400);
      Animated.spring(opChallengeY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else if (state.phase !== 'pre-roll' && state.phase !== 'building') {
      setOpChallengeVisible(false);
    }
    prevPhaseForOpChallenge.current = state.phase;
  }, [state.phase, state.activeOperation]);
  const hasIdentical = state.phase === 'pre-roll' && !state.hasPlayedCards && !state.activeOperation
    && state.consecutiveIdenticalPlays < 2 && cp && td
    && cp.hand.some(c => validateIdenticalPlay(c, td));

  // Identical card arrow hint — first time only (רק כשהדרכה מופעלת)
  useEffect(() => {
    if (!guidanceEnabledRef.current) return;
    if (hasIdentical && !identArrowSeen && tutLoaded && !identArrowVisible) {
      setIdentArrowVisible(true);
      identArrowX.setValue(0);
      identArrowLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(identArrowX, { toValue: 10, duration: 500, useNativeDriver: true }),
        Animated.timing(identArrowX, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]));
      identArrowLoop.current.start();
      const t = setTimeout(() => {
        identArrowLoop.current?.stop();
        setIdentArrowVisible(false);
        setIdentArrowSeen(true);
        AsyncStorage.setItem('lulos_ident_arrow_seen', 'true');
      }, 10000);
      return () => clearTimeout(t);
    }
    if (!hasIdentical && identArrowVisible) {
      identArrowLoop.current?.stop();
      setIdentArrowVisible(false);
      if (!identArrowSeen) {
        setIdentArrowSeen(true);
        AsyncStorage.setItem('lulos_ident_arrow_seen', 'true');
      }
    }
  }, [hasIdentical, identArrowSeen, tutLoaded]);

  // ── Contextual onboarding triggers ──
  const onbBlocked = tutVisible || state.notifications.some(n => n.id.startsWith('onb-')) || !!state.identicalAlert || state.pendingFractionTarget !== null;
  console.log('[ONB] onbBlocked:', onbBlocked, '{tutVisible:', tutVisible, 'hasOnbNotif:', state.notifications.some(n => n.id.startsWith('onb-')), 'identAlert:', !!state.identicalAlert, 'fracTarget:', state.pendingFractionTarget, '}');

  // 1. Game start — first time entering pre-roll (רק כשהדרכה מופעלת)
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (state.phase === 'pre-roll') {
      showOnb('onb_game_start', '🎰', 'ברוכים הבאים למשחק!', 'המטרה: היפטרו מכל הקלפים ביד! הטילו קוביות, בנו תרגיל, והניחו קלפים על הערימה.');
    }
  }, [tutLoaded, state.phase, onbBlocked]);

  // 2. Fraction card in hand
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (!cp) return;
    const hasFrac = cp.hand.some(c => c.type === 'fraction');
    if (hasFrac) {
      showOnb('onb_fraction', '⚔️', 'קלף שבר!', 'שבר תוקף את השחקן הבא! הוא יגן (קלף שמתחלק במכנה), יתקוף נגד (שבר נוסף), או ישלוף קלפי עונש.');
    }
  }, [tutLoaded, onbBlocked, cp?.hand.length]);

  // (Operation challenge and Joker guidance moved to guidance system below)

  // 5. Results button — first time validTargets populates
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (state.phase === 'building' && state.validTargets.length > 0) {
      showOnb('onb_results', '🎯', 'תוצאות אפשריות', 'לחץ על כפתור התוצאות בין השולחן ליד כדי לראות אילו מספרים אפשר להרכיב מהקוביות.');
    }
  }, [tutLoaded, onbBlocked, state.phase, state.validTargets.length]);

  // 6. Forward challenge — has opposite card while challenged
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (!cp || state.phase !== 'pre-roll' || !state.activeOperation || state.hasPlayedCards) return;
    const opposite = parallelOp[state.activeOperation];
    const hasOpposite = cp.hand.some(c => c.type === 'operation' && c.operation === opposite);
    if (hasOpposite) {
      showOnb('onb_forward', '⚡', 'העבר את האתגר!', 'יש לך קלף מקביל! תוכל להעביר את האתגר לשחקן הבא במקום לזרוק קוביות.');
    }
  }, [tutLoaded, onbBlocked, state.phase, state.activeOperation, cp?.hand.length]);

  // 7. First discard — after cards are discarded
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (state.lastDiscardCount > 0) {
      showOnb('onb_first_discard', '💡', 'השלכת קלפים!', 'כשנפטרים מקלפים — היד שלך מתרוקנת מהר יותר לניצחון!');
    }
  }, [tutLoaded, onbBlocked, state.lastDiscardCount]);

  // ── Guidance notification system ──
  // First time ever = full explanation, after that = short one-liner
  const showGuidance = useCallback((key: GuidanceKey, fullNotif: Omit<Notification, 'id'>, shortNotif: Omit<Notification, 'id'>) => {
    if (!guidanceEnabledRef.current) return;
    const isFirst = !guidanceSeen.current.has(key);
    if (isFirst) {
      guidanceSeen.current.add(key);
      AsyncStorage.setItem(key, 'true');
    }
    const n = isFirst ? fullNotif : shortNotif;
    dispatch({ type: 'PUSH_NOTIFICATION', payload: { id: `guidance-${key}-${Date.now()}`, ...n } });
  }, [dispatch]);

  // G1. Fraction attack — defender enters pre-roll with pendingFractionTarget
  const prevFracTarget = useRef<number | null>(null);
  useEffect(() => {
    if (state.pendingFractionTarget !== null && state.phase === 'pre-roll' && prevFracTarget.current === null) {
      const attacker = state.challengeSource ?? 'השחקן הקודם';
      const denom = state.fractionPenalty;
      const fracUni = denom === 2 ? '½' : denom === 3 ? '⅓' : denom === 4 ? '¼' : denom === 5 ? '⅕' : `1/${denom}`;
      showGuidance('guidance_fraction', {
        message: '', emoji: '⚔️',
        title: `${attacker} תקף אותך עם שבר ${fracUni}!`,
        body: `🛡️ הגנה — הנח קלף שמתחלק ב-${denom}\n⚔️ התקפה נגדית — הנח שבר נוסף (האתגר עובר לשחקן הבא!)\n😔 אין הגנה? שלוף ${denom} קלפי עונש`,
        style: 'warning', autoDismissMs: 8000,
      }, {
        message: `⚔️ ${attacker} תקף! הגן, תקוף נגד, או שלוף עונש`,
        style: 'warning', autoDismissMs: 5000,
      });
    }
    prevFracTarget.current = state.pendingFractionTarget;
  }, [state.pendingFractionTarget, state.phase]);

  // G2. Operation challenge — player enters pre-roll with activeOperation
  const prevOpChallenge = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase === 'pre-roll' && state.activeOperation && !state.hasPlayedCards && prevOpChallenge.current === null) {
      const attacker = state.challengeSource ?? 'השחקן הקודם';
      const symbol = opDisplay[state.activeOperation] ?? state.activeOperation;
      const opposite = parallelOp[state.activeOperation];
      const oppSymbol = opDisplay[opposite] ?? opposite;
      showGuidance('guidance_op_challenge', {
        message: '', emoji: '🎯',
        title: `${attacker} אתגר אותך עם סימן ${symbol}!`,
        body: `🎲 התמודדות — זרוק קוביות ובנה תרגיל עם הסימן ${symbol}\n⚔️ העברה — הנח קלף ${oppSymbol} מהיד כדי להעביר את האתגר הלאה\n😬 לא השתמשת בסימן? תשלוף קלף עונש`,
        style: 'warning', autoDismissMs: 8000,
      }, {
        message: `🎯 ${attacker} אתגר! השתמש בסימן, העבר, או קבל עונש`,
        style: 'warning', autoDismissMs: 5000,
      });
    }
    prevOpChallenge.current = state.activeOperation;
  }, [state.phase, state.activeOperation]);

  // G3. Identical card alert — when identicalAlert is set
  const prevIdentical = useRef<typeof state.identicalAlert>(null);
  useEffect(() => {
    if (state.identicalAlert && !prevIdentical.current) {
      const { playerName, cardDisplay } = state.identicalAlert;
      showGuidance('guidance_identical', {
        message: '', emoji: '🔄',
        title: `${playerName} הניח קלף זהה (${cardDisplay})!`,
        body: `✅ הנח גם אתה קלף זהה — דלג על קוביות והיפטר מקלף!\n🎲 התעלם — זרוק קוביות כרגיל\n⚠️ מוגבל לשימוש פעמיים ברצף!`,
        style: 'info', autoDismissMs: 8000,
      }, {
        message: `🔄 קלף זהה! הנח והיפטר, או זרוק כרגיל`,
        style: 'info', autoDismissMs: 5000,
      });
    }
    prevIdentical.current = state.identicalAlert;
  }, [state.identicalAlert]);

  // G4. Joker in hand — first detection per game
  const jokerGuidanceShown = useRef(false);
  useEffect(() => { jokerGuidanceShown.current = false; }, [state.players.length]); // reset on new game
  useEffect(() => {
    if (!tutLoaded || jokerGuidanceShown.current) return;
    if (!cp) return;
    if (state.phase !== 'pre-roll' && state.phase !== 'building' && state.phase !== 'solved') return;
    const hasJoker = cp.hand.some(c => c.type === 'joker');
    if (hasJoker) {
      jokerGuidanceShown.current = true;
      showGuidance('guidance_joker', {
        message: '', emoji: '🃏',
        title: 'יש לך ג׳וקר!',
        body: '⚔️ בחר סימן (+, −, ×, ÷) כדי לאתגר את השחקן הבא\n🛡️ מגן מכל התקפת שבר או פעולה',
        style: 'info', autoDismissMs: 8000,
      }, {
        message: '🃏 ג׳וקר! בחר סימן לאתגר',
        style: 'info', autoDismissMs: 4000,
      });
    }
  }, [tutLoaded, cp?.hand.length, state.phase]);

  // G5. Triple dice — all 3 dice show the same number
  const prevDiceForTriple = useRef<typeof state.dice>(null);
  useEffect(() => {
    if (!state.dice || state.dice === prevDiceForTriple.current) { prevDiceForTriple.current = state.dice; return; }
    prevDiceForTriple.current = state.dice;
    if (state.dice.die1 === state.dice.die2 && state.dice.die2 === state.dice.die3) {
      const val = state.dice.die1;
      showGuidance('guidance_triple', {
        message: '', emoji: '🎲',
        title: `שלישייה של ${val}!`,
        body: `😱 כל שאר השחקנים שולפים ${val} קלפי עונש!\n⚡ אין מה לעשות — זה קרה אוטומטית`,
        style: 'celebration', autoDismissMs: 8000,
      }, {
        message: `🎲 שלישייה! כולם שולפים ${val} קלפים`,
        style: 'celebration', autoDismissMs: 5000,
      });
    }
  }, [state.dice]);

  // רווח קבוע להתראות — השולחן והיד לא זזים כשמופיעה/נעלמת התראה
  const NOTIF_STRIP_RESERVED = 56;
  const bottomPad = 160 + NOTIF_STRIP_RESERVED + safe.insets.bottom;
  return (
    <ImageBackground source={gameBgImg} resizeMode="cover" style={{flex:1,width:SCREEN_W,minHeight:SCREEN_H,paddingTop:8,paddingBottom:bottomPad,overflow:'hidden'}}>

      {/* ── Background dice layers (decorative — stays absolute) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RoamingDice ref={bgDiceRef} />
      </View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WalkingDice />
      </View>

      {/* ── SLOT 1: שחקנים + חוקים בצד אחד, יציאה בצד השני ── */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:10,paddingTop:4,paddingBottom:4}}>
        <PlayerSidebar secsLeft={secsLeft} timerTotal={TIMER_TOTAL} timerRunning={timerRunning} />
        <LulosButton text="יציאה" color="red" width={72} height={32} fontSize={11} onPress={()=>dispatch({type:'RESET_GAME'})} />
      </View>

      {/* ── SLOT 2: ערימה בצד אחד, תוצאות אפשריות בצד השני (החלפת מיקום) ── */}
      <View style={{flexShrink:0,flexDirection:'row',alignItems:'center',justifyContent:'flex-start',gap:20,paddingHorizontal:12,paddingVertical:4,zIndex:1}}>
        <View style={{alignItems:'center',gap:4,position:'relative',minWidth:90}}>
          <DiscardPile />
          {fracHintVisible && !fracArrowSeen && !state.pendingFractionTarget && (
            <Animated.Text style={{position:'absolute',left:-30,top:50,fontSize:24,color:'#FFD700',transform:[{translateX:fracArrowX}]}} pointerEvents="none">→</Animated.Text>
          )}
        </View>
        {identArrowVisible && (
          <Animated.View style={{flexDirection:'row',alignItems:'center',gap:4,transform:[{translateX:identArrowX}]}} pointerEvents="none">
            <View style={alertBubbleStyle.box}>
              <Text style={alertBubbleStyle.title}>🎉 יש לך קלף זהה!</Text>
              <Text style={alertBubbleStyle.body}>הנח אותו על הערימה — דלג על קוביות והיפטר מקלף!</Text>
            </View>
            <GoldArrow direction="right" size={48} />
          </Animated.View>
        )}
        {state.showPossibleResults && state.validTargets.length > 0 && (state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards && (
          <ResultsSlot onToggle={toggleResultsBadges} filteredResults={(() => {
            const handValuesForStrip = new Set(cp?.hand.filter(c => c.type === 'number').map(c => c.value!) ?? []);
            return state.validTargets.filter(t => handValuesForStrip.has(t.result));
          })()} matchCount={state.validTargets.filter(t => cp?.hand.some(c => c.type === 'number' && c.value === t.result)).length} />
        )}
      </View>

      {/* ── SLOT 3: Game area — flexGrow:1, flexShrink:1, minHeight:200 ── */}
      <View style={{flexGrow:1,flexShrink:1,minHeight:200,paddingHorizontal:12,zIndex:2}}>
        <ImageBackground
          source={pokerTableImg}
          style={{
            alignSelf:'center',
            width:'100%',
            height:240,
            justifyContent:'center',
            alignItems:'center',
            paddingVertical:10,
          }}
          resizeMode="stretch"
        >
          <EquationBuilder onConfirmChange={setEqConfirm} onResultChange={setEqResult} />
          {/* טיימר — טבעת מוזהבת על השולחן, עדין בלי מספרים */}
          {state.timerSetting !== 'off' && (
            <View style={{ position: 'absolute', bottom: 28, alignSelf: 'center' }}>
              <TimerBar totalTime={TIMER_TOTAL} secsLeft={secsLeft} running={timerRunning} />
            </View>
          )}
        </ImageBackground>
        {/* Operation card hints — below the green table for visibility */}
        {(() => {
          const isSolved = state.phase === 'solved';
          const eqOpOp = getEqOpCardOperation(state);
          if (isSolved) return null;
          if (state.equationOpCard && state.equationOpPosition === null) {
            return (
              <View style={{ backgroundColor: 'rgba(167,139,250,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)', paddingHorizontal: 14, paddingVertical: 8, marginTop: 6, marginHorizontal: 4 }}>
                <Text style={{ color: '#C4B5FD', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 }}>
                  👆 לחץ על סלוט ⬦ בתרגיל כדי למקם את קלף הפעולה
                </Text>
              </View>
            );
          }
          if (state.equationOpCard && state.equationOpPosition !== null) {
            return (
              <View style={{ backgroundColor: 'rgba(252,165,165,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(252,165,165,0.35)', paddingHorizontal: 14, paddingVertical: 8, marginTop: 6, marginHorizontal: 4 }}>
                <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 }}>
                  ⚔️ קלף הפעולה יאתגר את השחקן הבא עם {opDisplay[eqOpOp!] ?? eqOpOp}
                </Text>
              </View>
            );
          }
          return null;
        })()}
        <StagingZone />
      </View>

      {/* ── SLOT 4: רווח 100px — היד עלתה ב־20px ── */}
      <View style={{flexShrink:0,height:100}} />

      {/* ── SLOT 5: מניפה — גובה זהה למסך השחקן (HAND_STRIP_HEIGHT) ── */}
      <View style={{flexShrink:0,height:HAND_STRIP_HEIGHT,alignItems:'center',justifyContent:'center',width:'100%'}}>
        <PlayerHand />
      </View>

      {/* תוצאות אפשריות — overlay ממורכז מעל היד ── */}
      {state.showPossibleResults && state.validTargets.length > 0 && (state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards && (
        <View style={{position:'absolute',bottom:HAND_STRIP_HEIGHT + 160,left:0,right:0,zIndex:5,alignItems:'center'}} pointerEvents="box-none">
          <ResultsStripBelowTable resultsOpen={resultsOpen} filteredResults={(() => {
            const handValuesForStrip = new Set(cp?.hand.filter(c => c.type === 'number').map(c => c.value!) ?? []);
            return state.validTargets.filter(t => handValuesForStrip.has(t.result));
          })()} />
        </View>
      )}

      {/* ── SLOT 6: Action buttons — תמיד מעל ההתראה ── */}
      {(() => {
        const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved';
        const fracMin = challengeMinimized && state.pendingFractionTarget !== null;
        const showDraw = (bl||so)&&!state.hasPlayedCards&&state.pendingFractionTarget===null;
        const showFracDraw = fracMin && !state.hasPlayedCards;
        const showConfirmEq = bl && !!eqConfirm;
        const btnCount = (canRoll?1:0)+(showDraw?1:0)+(showFracDraw?1:0)+(showConfirmEq?1:0);
        // ActionBar buttons: "סיים תור" when hasPlayedCards
        const abEndTurn = (pr||bl||so)&&state.hasPlayedCards;
        const totalBtns = btnCount + (abEndTurn?1:0);
        // GOLDEN RULE fallback: if nothing else shows, show draw card
        const showFallback = totalBtns === 0 && (pr||bl||so);
        const solo = (totalBtns === 1) || showFallback;
        return (
          <View style={{position:'absolute',bottom:Math.max(safe.insets.bottom,(NOTIF_STRIP_RESERVED + safe.insets.bottom) - 40),left:0,right:0,height:160,zIndex:10,overflow:'hidden'}}>
            <View style={{flex:1,alignItems:'center',gap:0,paddingHorizontal:20,paddingVertical:2}}>
              {canRoll && <FlashingRollButton onPress={handleRoll} />}
              {showConfirmEq && (
                <LulosButton text="▶ בחר קלפים" color="green" width={solo?240:200} height={solo?48:36} fontSize={solo?18:undefined} style={solo?{paddingVertical:16}:undefined} onPress={eqConfirm!.onConfirm} />
              )}
              <ActionBar />
              <View style={{flex:1}} />
              {showDraw && (
                <LulosButton text={'\u200Fשלוף קלף - ויתור'} color="red" height={solo?48:32} fontSize={solo?18:13} style={solo?{paddingVertical:16}:undefined} onPress={()=>dispatch({type:'DRAW_CARD'})} />
              )}
              {showFracDraw && (
                <LulosButton text={'\u200Fשלוף קלף - ויתור'} color="red" height={solo?48:32} fontSize={solo?18:13} style={solo?{paddingVertical:16}:undefined} onPress={()=>dispatch({type:'DEFEND_FRACTION_PENALTY'})} />
              )}
              {showFallback && (
                <LulosButton text={'\u200Fשלוף קלף - ויתור'} color="red" height={48} fontSize={18} style={{paddingVertical:16}} onPress={()=>dispatch({type:'DRAW_CARD'})} />
              )}
            </View>
            <View style={{marginTop:20}}>
              <BottomControlsBar />
            </View>
          </View>
        );
      })()}

      {showCel && <CelebrationFlash onDone={()=>setShowCel(false)} />}

      {/* ── Sheet A: Fraction HINT (💡) — zIndex:40 ── */}
      {fracHintVisible && !state.pendingFractionTarget && !state.identicalAlert && (
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(15,23,42,0.97)',borderTopLeftRadius:24,borderTopRightRadius:24,borderTopWidth:2,borderColor:'rgba(218,165,32,0.5)',padding:20,paddingHorizontal:24,paddingBottom:28,zIndex:40,transform:[{translateY:fracHintY}]}}>
          <View style={{alignSelf:'center',width:40,height:4,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:2,marginBottom:16}} />
          <Text style={{color:'#FFD700',fontSize:22,fontWeight:'900',textAlign:'center',marginBottom:16}}>💡 יש לך קלף שבר!</Text>
          <Text style={{color:'#E2E8F0',fontSize:17,fontWeight:'600',textAlign:'center',lineHeight:26,marginBottom:8}}>⚔️ תקוף — הנח קלף שבר, התור עובר ליריב</Text>
          <Text style={{color:'#E2E8F0',fontSize:17,fontWeight:'600',textAlign:'center',lineHeight:26,marginBottom:4}}>🧮 בנה תרגיל — שחק רגיל עם הקוביות</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={dismissFracHint} style={{alignSelf:'center',marginTop:18,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,0.15)',paddingHorizontal:28,paddingVertical:10}}>
            <Text style={{color:'rgba(255,255,255,0.5)',fontSize:14,fontWeight:'700'}}>הבנתי 👍</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Floating 💡 recall button — appears after dismissing fraction hint */}
      {fracHintRecall && !fracHintVisible && !state.pendingFractionTarget && !state.identicalAlert && (
        <TouchableOpacity onPress={recallFracHint} activeOpacity={0.7} style={{position:'absolute',bottom:168,right:16,width:40,height:40,borderRadius:20,backgroundColor:'rgba(52,168,83,0.25)',borderWidth:1.5,borderColor:'rgba(52,168,83,0.5)',alignItems:'center',justifyContent:'center',zIndex:35}}>
          <Text style={{fontSize:20}}>💡</Text>
        </TouchableOpacity>
      )}

      {/* ── Sheet B: Fraction CHALLENGE (⚠️) — zIndex:50, no auto-dismiss ── */}
      {state.pendingFractionTarget !== null && !challengeMinimized && (
        <View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(15,23,42,0.97)',borderTopLeftRadius:24,borderTopRightRadius:24,borderTopWidth:2,borderColor:'rgba(239,68,68,0.5)',padding:20,paddingHorizontal:24,paddingBottom:28,zIndex:50}}>
          <View style={{alignSelf:'center',width:40,height:4,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:2,marginBottom:16}} />
          <Text style={{color:'#FCA5A5',fontSize:22,fontWeight:'900',textAlign:'center',marginBottom:6}}>⚔️ אותגרת!</Text>
          <Text style={{color:'#E2E8F0',fontSize:14,fontWeight:'700',textAlign:'center',marginBottom:14}}>יש לך 3 אפשרויות:</Text>
          <View style={{gap:10,marginBottom:16}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'rgba(74,222,128,0.1)',borderRadius:12,borderWidth:1,borderColor:'rgba(74,222,128,0.3)',paddingHorizontal:14,paddingVertical:10}}>
              <Text style={{fontSize:18}}>🛡️</Text>
              <Text style={{color:'#4ADE80',fontSize:14,fontWeight:'700',flex:1,textAlign:'right',lineHeight:20}}>{`הגנה — הנח קלף שמתחלק ב-${state.fractionPenalty}`}</Text>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'rgba(253,224,71,0.08)',borderRadius:12,borderWidth:1,borderColor:'rgba(253,224,71,0.3)',paddingHorizontal:14,paddingVertical:10}}>
              <Text style={{fontSize:18}}>⚔️</Text>
              <Text style={{color:'#FDE68A',fontSize:14,fontWeight:'700',flex:1,textAlign:'right',lineHeight:20}}>התקפה נגדית — הנח שבר נוסף (האתגר עובר הלאה!)</Text>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'rgba(239,68,68,0.08)',borderRadius:12,borderWidth:1,borderColor:'rgba(239,68,68,0.3)',paddingHorizontal:14,paddingVertical:10}}>
              <Text style={{fontSize:18}}>😔</Text>
              <Text style={{color:'#FCA5A5',fontSize:14,fontWeight:'700',flex:1,textAlign:'right',lineHeight:20}}>{`אין הגנה? שלוף ${state.fractionPenalty} קלפי עונש`}</Text>
            </View>
          </View>
          <Text style={{color:'rgba(255,255,255,0.6)',fontSize:12,fontWeight:'600',textAlign:'center',marginBottom:12,lineHeight:18}}>⚠️ ג׳וקר לא מגן מפני התקפת שבר — רק קלף מספר שמתחלק או קלף שבר.</Text>
          <View style={{alignItems:'center'}}>
            <CasinoButton text="👆 הנח קלף מהיד" width={240} height={56} onPress={() => setChallengeMinimized(true)} />
          </View>
          <View style={{alignItems:'center',marginTop:8}}>
            <TouchableOpacity onPress={() => dispatch({type:'DEFEND_FRACTION_PENALTY'})} activeOpacity={0.7} style={{backgroundColor:'rgba(239,68,68,0.15)',borderWidth:1.5,borderColor:'rgba(239,68,68,0.4)',paddingHorizontal:24,paddingVertical:10,borderRadius:12}}>
              <Text style={{color:'#EF4444',fontSize:14,fontWeight:'800'}}>{`😔 שלוף ${state.fractionPenalty} קלפי עונשין`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Sheet C: Identical ALERT (🔄) — zIndex:50 ── */}
      {!!state.identicalAlert && (
        <View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(15,23,42,0.97)',borderTopLeftRadius:24,borderTopRightRadius:24,borderTopWidth:2,borderColor:'rgba(218,165,32,0.5)',padding:14,paddingHorizontal:20,paddingBottom:24,zIndex:50}}>
          <View style={{alignSelf:'center',width:40,height:4,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:2,marginBottom:14}} />
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:10}}>
            <Text style={{fontSize:29}}>🔄</Text>
            <Text style={{color:'#2196F3',fontSize:17,fontWeight:'900'}}>קלף זהה!</Text>
          </View>
          <Text style={{color:'rgba(255,255,255,0.55)',fontSize:14,textAlign:'center',lineHeight:20}}>
            {state.identicalAlert!.playerName} הניח קלף זהה ({state.identicalAlert!.cardDisplay}) — דילוג על קוביות!
          </Text>
          {state.identicalAlert!.consecutive === 1 && (
            <Text style={{color:'rgba(251,188,5,0.8)',fontSize:13,textAlign:'center',marginTop:6,marginBottom:10}}>⚠️ נותר עוד שימוש אחד</Text>
          )}
          {(state.identicalAlert!.consecutive ?? 0) >= 2 && (
            <View style={{backgroundColor:'rgba(231,76,60,0.15)',borderRadius:12,padding:12,borderWidth:1,borderColor:'rgba(231,76,60,0.3)',marginTop:6,width:'100%'}}>
              <Text style={{color:'#EF4444',fontSize:13,fontWeight:'800',textAlign:'center'}}>⚠️ זה השימוש האחרון! השחקן הבא חייב להטיל קוביות</Text>
            </View>
          )}
          <View style={{alignItems:'center',marginTop:14,marginBottom:6}}>
            <CasinoButton text="✅ הבנתי!" width={240} height={56} onPress={() => dispatch({type:'DISMISS_IDENTICAL_ALERT'})} />
          </View>
        </View>
      )}


      {/* ── Sheet D: Operation CHALLENGE alert (⚔️) — zIndex:52, manual dismiss ── */}
      {opChallengeVisible && state.activeOperation && (() => {
        const symbol = opDisplay[state.activeOperation] ?? state.activeOperation;
        const oppositeOp = parallelOp[state.activeOperation];
        const oppositeSymbol = opDisplay[oppositeOp] ?? oppositeOp;
        const hasOpposite = cp.hand.some(c => (c.type === 'operation' && c.operation === oppositeOp) || c.type === 'joker');
        return (
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(15,23,42,0.97)',borderTopLeftRadius:24,borderTopRightRadius:24,borderTopWidth:2,borderColor:'rgba(249,168,37,0.5)',padding:14,paddingHorizontal:20,paddingBottom:28,zIndex:52,transform:[{translateY:opChallengeY}]}}>
          <View style={{alignSelf:'center',width:40,height:4,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:2,marginBottom:14}} />
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:10}}>
            <Text style={{fontSize:32}}>⚔️</Text>
            <Text style={{color:'#F9A825',fontSize:20,fontWeight:'900'}}>אתגר פעולה!</Text>
          </View>
          <Text style={{color:'#FDE68A',fontSize:16,fontWeight:'700',textAlign:'center',lineHeight:24,marginBottom:12}}>
            {`${state.challengeSource ?? ''} אתגר/ה אותך עם ${symbol}!`}
          </Text>
          <View style={{height:1,backgroundColor:'rgba(255,255,255,0.08)',marginVertical:6}} />
          <Text style={{color:'#E2E8F0',fontSize:15,fontWeight:'700',textAlign:'center',lineHeight:22,marginBottom:4}}>
            {`🎲 הטל קוביות ובנה תרגיל עם סימן ${symbol}`}
          </Text>
          <View style={{height:1,backgroundColor:'rgba(255,255,255,0.08)',marginVertical:6}} />
          <Text style={{color:'#A78BFA',fontSize:15,fontWeight:'700',textAlign:'center',lineHeight:22,marginBottom:4}}>
            {`⚔️ העבר את האתגר — הנח קלף ${oppositeSymbol} מהיד`}
          </Text>
          {hasOpposite && (
            <View style={{backgroundColor:'rgba(74,222,128,0.1)',borderRadius:12,padding:12,borderWidth:1,borderColor:'rgba(74,222,128,0.3)',marginTop:8}}>
              <Text style={{color:'#4ADE80',fontSize:14,fontWeight:'800',textAlign:'center',lineHeight:22}}>
                {`✅ יש לך קלף ${oppositeSymbol} ביד! לחץ עליו כדי להעביר את האתגר`}
              </Text>
            </View>
          )}
          <View style={{alignItems:'center',marginTop:16,marginBottom:6}}>
            <CasinoButton text="הבנתי! 🎲" width={240} height={56} onPress={() => {
              Animated.timing(opChallengeY, { toValue: 400, duration: 300, useNativeDriver: true }).start(() => setOpChallengeVisible(false));
            }} />
          </View>
        </Animated.View>
        );
      })()}

      {/* ── Operation Feedback Sheet — zIndex:45, auto-dismiss 3-4s ── */}
      {/* Feedback notification moved to TurnTransition */}

      {/* ── Tutorial tip sheet — zIndex:60, above everything ── */}
      {tutVisible && tutStep >= 1 && tutStep <= 3 && (
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(15,23,42,0.97)',borderTopLeftRadius:24,borderTopRightRadius:24,borderTopWidth:2,borderColor:'rgba(218,165,32,0.5)',padding:16,paddingBottom:24,zIndex:60,transform:[{translateY:tutY}]}}>
          <View style={{alignSelf:'center',width:40,height:4,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:2,marginBottom:14}} />
          <View style={{alignItems:'center',gap:10}}>
            <Text style={{fontSize:36}}>{tutStep===1?'🎲':tutStep===2?'🧮':'⚔️'}</Text>
            <Text style={{color:'#FFD700',fontSize:22,fontWeight:'900',textAlign:'center'}}>
              {tutStep===1?'איך משחקים?':tutStep===2?'בנה תרגיל':'קלף שבר'}
            </Text>
            <Text style={{color:'#E2E8F0',fontSize:15,fontWeight:'700',textAlign:'center',lineHeight:22}}>
              {tutStep===1?'הטל קוביות ובנה תרגיל חשבון — התוצאה = קלף שתזרוק מהיד'
               :tutStep===2?'לחץ על קובייה → בחר סלוט → התוצאה חייבת להתאים לקלף ביד'
               :'קלף שבר = תקיפה! הנח אותו ואתגר את היריב'}
            </Text>
            <LulosButton text="הבנתי! 👍" color="green" width={180} height={48} onPress={dismissTut} />
          </View>
        </Animated.View>
      )}

    </ImageBackground>
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
    <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24}}>
      <Confetti />
      <Text style={{fontSize:56,marginBottom:8}}>🏆</Text>
      <Text style={{color:'#FFF',fontSize:28,fontWeight:'800',textAlign:'center'}}>המשחק נגמר!</Text>
      <Text style={{color:'#FACC15',fontSize:20,fontWeight:'700',marginTop:8,marginBottom:24,textAlign:'center'}} numberOfLines={1}>{state.winner?.name} ניצח/ה!</Text>
      <ScrollView style={{width:'100%',maxHeight:220}} contentContainerStyle={{paddingHorizontal:8,alignItems:'center'}} showsVerticalScrollIndicator={false}>
        <View style={{backgroundColor:'rgba(55,65,81,0.5)',borderRadius:12,padding:16,width:'100%'}}>
          <Text style={{color:'#9CA3AF',fontSize:11,fontWeight:'700',letterSpacing:1,marginBottom:10,textAlign:'right'}}>תוצאות סופיות</Text>
          {sorted.map((p,i)=><View key={p.id} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:3}}><Text style={{color:'#D1D5DB',fontSize:14}} numberOfLines={1}>{i+1}. {p.name}{p.hand.length===0?' ★':''}</Text><Text style={{color:'#9CA3AF',fontSize:14}}>{p.hand.length} קלפים נותרו</Text></View>)}
        </View>
      </ScrollView>
      <LulosButton text="שחק/י שוב" color="green" width={280} height={64} onPress={()=>dispatch({type:'RESET_GAME'})} style={{marginTop:20}} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ALERT BUBBLE — צורה ושפה מאומצים (קלף זהה): קופסה חומה מעוגלת, כותרת צהובה, גוף אפור
// ═══════════════════════════════════════════════════════════════
const alertBubbleStyle = StyleSheet.create({
  box: {
    backgroundColor: '#2C1810',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(212,165,116,0.55)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    maxWidth: 280,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  title: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 4,
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 20,
  },
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION ZONE — always mounted at App level (אימוץ צורה ושפה של ההתראה)
// ═══════════════════════════════════════════════════════════════

function NotificationZone() {
  const { state, dispatch } = useGame();
  console.log('[NZ] render, phase:', state.phase, 'queue length:', state.notifications?.length, 'notifications:', JSON.stringify(state.notifications?.map(n => ({id:n.id,title:n.title,msg:n.message?.slice(0,30)}))));
  // Hide notifications on the welcome screen (turn-transition phase)
  const notif = state.phase === 'turn-transition' ? null : (state.notifications[0] ?? null);
  const NOTIF_STRIP_H = 56;
  const slideY = useRef(new Animated.Value(NOTIF_STRIP_H)).current;
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!notif) {
      prevId.current = null;
      return;
    }
    if (notif.id === prevId.current) return;
    prevId.current = notif.id;
    slideY.setValue(NOTIF_STRIP_H);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    if (notif.autoDismissMs) {
      const t = setTimeout(() => {
        Animated.timing(slideY, { toValue: NOTIF_STRIP_H, duration: 200, useNativeDriver: true }).start(() => {
          dispatch({ type: 'DISMISS_NOTIFICATION', id: notif.id });
        });
      }, notif.autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [notif?.id]);

  if (!notif) return null;

  const displayTitle = notif.title || notif.message;
  const displayBody = notif.body || (notif.title ? notif.message : '');

  return (
    <Animated.View style={{
      position:'absolute', bottom:20, left:16, right:16, zIndex:9999,
      transform:[{translateY:slideY}],
    }} pointerEvents="box-none">
      <View style={[alertBubbleStyle.box, { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: '100%' }]}>
        {notif.emoji && <Text style={{fontSize:26}}>{notif.emoji}</Text>}
        <View style={{flex:1}}>
          <Text style={[alertBubbleStyle.title, { marginBottom: displayBody ? 4 : 0 }]}>{displayTitle}</Text>
          {!!displayBody && <Text style={alertBubbleStyle.body}>{displayBody}</Text>}
        </View>
        <TouchableOpacity onPress={() => dispatch({ type: 'DISMISS_NOTIFICATION', id: notif.id })} hitSlop={{top:12,bottom:12,left:12,right:12}}>
          <View style={{width:28,height:28,borderRadius:14,backgroundColor:'rgba(255,215,0,0.2)',borderWidth:1.5,borderColor:'rgba(255,215,0,0.5)',alignItems:'center',justifyContent:'center'}}>
            <Text style={{color:'#FFD700',fontSize:14,fontWeight:'900'}}>✓</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
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

function AppShell({ showSplash, setShowSplash }: { showSplash: boolean; setShowSplash: (v: boolean) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#0a1628',
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }}>
      <StatusBar style="light" />
      <ConditionalWalkingDice />
      <ConditionalFloatingBg />
      <GameRouter />
      <NotificationZone />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </View>
  );
}

function App() {
  const [fontsLoaded] = useFonts({ Fredoka_700Bold });
  const [showSplash, setShowSplash] = useState(true);
  if (!fontsLoaded) return null;
  return (
    <GameProvider>
      <AppShell showSplash={showSplash} setShowSplash={setShowSplash} />
    </GameProvider>
  );
}

// SafeAreaProvider ברמת השורש — חובה לפני כל שימוש ב-useSafeAreaInsets
registerRootComponent(function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
});
