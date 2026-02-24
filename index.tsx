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
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import Svg, { Circle as SvgCircle, Rect as SvgRect, Path as SvgPath, Polygon as SvgPolygon } from 'react-native-svg';
import Dice3D from './Dice3D';
import { GoldDieFace } from './AnimatedDice';

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
  jokerModalOpen: boolean;
  equationOpCard: Card | null;
  equationOpPosition: number | null;
  lastMoveMessage: string | null;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  winner: Player | null;
  message: string;
}

type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full' }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE'; values?: DiceResult }
  | { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string }
  | { type: 'REVERT_TO_BUILDING' }
  | { type: 'STAGE_CARD'; card: Card }
  | { type: 'UNSTAGE_CARD'; card: Card }
  | { type: 'CONFIRM_STAGED' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'PLAY_OPERATION'; card: Card }
  | { type: 'SELECT_EQ_OP'; card: Card }
  | { type: 'PLACE_EQ_OP'; position: number }
  | { type: 'REMOVE_EQ_OP' }
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
  consecutiveIdenticalPlays: 0, identicalAlert: null, jokerModalOpen: false, equationOpCard: null, equationOpPosition: null,
  lastMoveMessage: null, lastEquationDisplay: null,
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
    fractionPenalty: 0, equationOpCard: null, equationOpPosition: null,
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
      return { ...st, players: st.players.map(p => ({ ...p, calledLolos: false })), currentPlayerIndex: next, phase: 'turn-transition', dice: null, selectedCards: [], stagedCards: [], equationResult: null, validTargets: [], message: '', activeOperation: null, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: false, equationOpCard: null, equationOpPosition: null };
    }
    case 'BEGIN_TURN': {
      if (st.activeOperation) {
        const cp = st.players[st.currentPlayerIndex];
        const has = cp.hand.some(c => (c.type === 'operation' && c.operation === st.activeOperation) || c.type === 'joker');
        if (has) return { ...st, phase: 'pre-roll', message: `פעולת ${st.activeOperation}! שחק/י קלף פעולה תואם או ג'וקר כדי להגן.` };
        let s = drawFromPile(st, 2, st.currentPlayerIndex);
        return { ...s, phase: 'pre-roll', activeOperation: null, message: `אין הגנה מפני ${st.activeOperation}! שלפת 2 קלפי עונשין.` };
      }
      // Fraction attack: only if active AND not already resolved
      if (st.pendingFractionTarget !== null && !st.fractionAttackResolved) {
        return { ...st, phase: 'pre-roll', message: '' };
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
      const eqChallenge = (st.equationOpCard && st.equationOpPosition === 2) ? st.equationOpCard.operation! : null;
      const stNewActiveOp = eqChallenge ?? (stOpCard ? stOpCard.operation! : null);
      const stLastNum = stNumbers[stNumbers.length - 1];
      const stToast = stNewActiveOp
        ? `⚔️ ${stCp.name}: הניח סימן ${stNewActiveOp} — אתגר!`
        : `✅ ${stCp.name}: ${st.lastEquationDisplay || ''} → הניח ${stLastNum.value}`;
      let stNs: GameState = { ...st, players: stNp, discardPile: stDiscard, stagedCards: [], selectedCards: [], consecutiveIdenticalPlays: 0, hasPlayedCards: true, lastCardValue: stLastNum.value ?? null, activeOperation: stNewActiveOp ?? st.activeOperation, equationOpCard: null, equationOpPosition: null, lastMoveMessage: stToast, lastEquationDisplay: null, message: stNewActiveOp ? `אתגר פעולה ${stNewActiveOp} לשחקן הבא!` : '' };
      stNs = checkWin(stNs);
      if (stNs.phase === 'game-over') return stNs;
      return endTurnLogic(stNs);
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
      if (st.phase !== 'building' || st.equationOpCard) return st;
      if (action.card.type !== 'operation') return st;
      return { ...st, equationOpCard: action.card, equationOpPosition: null };
    }
    case 'PLACE_EQ_OP': {
      console.log('[REDUCER] PLACE_EQ_OP', 'pos=', action.position, 'hasCard=', !!st.equationOpCard);
      if (!st.equationOpCard || action.position < 0 || action.position > 2) return st;
      return { ...st, equationOpPosition: action.position };
    }
    case 'REMOVE_EQ_OP': {
      console.log('[REDUCER] REMOVE_EQ_OP');
      return { ...st, equationOpCard: null, equationOpPosition: null };
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
          fractionAttackResolved: false,
          lastMoveMessage: `⚔️ ${cp.name}: חסם בשבר ${action.card.fraction} — אתגר!`,
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
      if (action.card.type !== 'number' || action.card.value !== st.pendingFractionTarget) return st;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, action.card], selectedCards: [], pendingFractionTarget: null, fractionPenalty: 0, fractionAttackResolved: true, lastCardValue: action.card.value ?? null, message: 'הגנה מוצלחת!' });
      if (ns.phase === 'game-over') return ns;
      return { ...ns, phase: 'pre-roll', hasPlayedCards: false };
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
  const w = small ? 80 : 110;
  const h = small ? 115 : 158;
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
          borderBottomWidth: 6, borderBottomColor: bottomEdge,
          transform: [{ translateY: selected ? -8 : (active ? -4 : 0) }],
        }, shadowStyle]}>
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
  const fs = small ? 42 : 58;
  const maxOff = small ? 6 : 12;
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
  const fs = small ? 30 : 42;
  const maxOff = small ? 4 : 8;
  const lineW = small ? 30 : 44;
  const lineH = small ? 4 : 6;
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
  const fs = small ? 38 : 52;
  const maxOff = small ? 6 : 12;
  return (
    <BaseCard borderColor={cl.face} selected={selected} onPress={onPress} small={small}>
      <Text3D text={display} fontSize={fs} faceColor={cl.face} darkColor={cl.dark} lightColor={cl.light} maxOffset={maxOff} />
    </BaseCard>
  );
}

function JokerCard({ card: _c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const w = small ? 80 : 110;
  const h = small ? 115 : 158;
  const bw = 3;
  const maxOff = small ? 4 : 6;
  const cornerFs = small ? 13 : 18;
  const svgSize = small ? 40 : 60;
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
  const canRoll = state.phase === 'pre-roll' && !state.hasPlayedCards && state.pendingFractionTarget === null && !state.activeOperation;

  // After rolling: show static gold dice
  if (state.dice) {
    return (
      <View style={{alignItems:'center',gap:10}}>
        <View style={{flexDirection:'row',gap:14}}>
          <GoldDieFace value={state.dice.die1} />
          <GoldDieFace value={state.dice.die2} />
          <GoldDieFace value={state.dice.die3} />
        </View>
      </View>
    );
  }

  // Pre-roll: show 3D dice with roll button
  return (
    <Dice3D
      onRollComplete={(vals) => {
        dispatch({ type: 'ROLL_DICE', values: { die1: vals[0], die2: vals[1], die3: vals[2] } });
      }}
      disabled={!canRoll}
    />
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

const SLOT_SZ = 52; const OP_SZ = 44;

function EquationBuilder() {
  const { state, dispatch } = useGame();
  // slots[i] = index into diceValues, or null if empty
  const [slots, setSlots] = useState<(number|null)[]>([null, null, null]);
  const [ops, setOps] = useState<string[]>(['+', '+']);
  const [resultsOpen, setResultsOpen] = useState(false);
  const diceKey = state.dice ? `${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  useEffect(() => { setSlots([null,null,null]); setOps(['+','+']); setResultsOpen(false); }, [diceKey]);

  // Show in building phase AND in solved phase (Bug 8: keep visible)
  const showBuilder = (state.phase === 'building' || state.phase === 'solved') && state.dice && !state.activeOperation && state.pendingFractionTarget === null;
  if (!showBuilder) return null;
  const isSolved = state.phase === 'solved';

  const diceValues = [state.dice!.die1, state.dice!.die2, state.dice!.die3];

  // Which dice indices are currently placed in slots
  const usedDice = new Set(slots.filter(s => s !== null) as number[]);

  // Tap a dice button: place in first empty slot, or remove if already placed
  const hDice = (dIdx: number) => {
    if (isSolved) return;
    if (usedDice.has(dIdx)) {
      // Remove from whichever slot it's in
      setSlots(prev => prev.map(s => s === dIdx ? null : s));
    } else {
      // Place in first empty slot
      setSlots(prev => {
        const n = [...prev];
        const emptyIdx = n.indexOf(null);
        if (emptyIdx !== -1) n[emptyIdx] = dIdx;
        return n;
      });
    }
  };

  // Tap a filled slot: remove the die from it
  const hSlot = (i: number) => {
    if (isSolved) return;
    if (slots[i] !== null) {
      setSlots(prev => { const n=[...prev]; n[i]=null; return n; });
    }
  };

  // Cycle operators on tap: + → − → × → ÷ → '' (empty/skip) → +
  const OP_CYCLE = ['+', '-', '×', '÷', ''];
  const cycleOp = (pos: number) => {
    try {
      if (isSolved) return;
      setOps(prev => {
        const n = [...prev];
        const ci = OP_CYCLE.indexOf(n[pos]);
        const next = OP_CYCLE[ci >= 0 ? (ci + 1) % OP_CYCLE.length : 0];
        console.log('OPERATOR CYCLED TO', next, 'at pos', pos);
        n[pos] = next;
        return n;
      });
    } catch (e) { console.warn('cycleOp error', e); }
  };

  // Collect active slots: skip slots cut off by empty '' operator before them
  // slot[i] is cut off if i > 0 and ops[i-1] === ''
  const active: {val: number, connectOp: string | null}[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      if (slots[i] === null) continue; // slot empty — skip
      if (i > 0 && ops[i-1] === '') continue; // cut off by empty operator — skip
      const val = diceValues[slots[i]!];
      if (typeof val !== 'number' || !Number.isFinite(val)) continue;
      if (active.length === 0) {
        active.push({val, connectOp: null});
      } else {
        active.push({val, connectOp: ops[i-1]});
      }
    }
  } catch (e) { console.warn('active collection error', e); }

  let cr: number | null = null;
  try {
    if (active.length >= 2) {
      let r: number | null = active[0].val;
      for (let k = 1; k < active.length && r !== null; k++) {
        const op = active[k].connectOp;
        if (!op || op === '') { r = null; break; }
        if (op === '+') r = r + active[k].val;
        else if (op === '-') r = r - active[k].val;
        else if (op === '×') r = r * active[k].val;
        else if (op === '÷') r = (active[k].val !== 0 && r % active[k].val === 0) ? r / active[k].val : null;
        else r = null;
      }
      // Guard against NaN, Infinity, undefined
      if (r !== null && (typeof r !== 'number' || !Number.isFinite(r))) r = null;
      cr = r;
    }
  } catch (e) { console.warn('equation calc error', e); cr = null; }

  const filledCount = slots.filter(s => s !== null).length;
  const ok = cr !== null && Number.isFinite(cr) && cr >= 0 && Number.isInteger(cr) && filledCount >= 2 && state.validTargets.some(t => t.result === cr);
  console.log('BTN STATE:', {result: cr, slots, filledCount, ok, activeLen: active.length});
  const hConfirm = () => {
    if (!ok || cr === null) return;
    const parts: string[] = [String(active[0].val)];
    for (let k = 1; k < active.length; k++) { parts.push(active[k].connectOp || '+'); parts.push(String(active[k].val)); }
    dispatch({ type: 'CONFIRM_EQUATION', result: cr, equationDisplay: parts.join(' ') + ` = ${cr}` });
  };

  return (
    <View style={[eqS.wrap, isSolved && {opacity: 0.5}]}>
      <Text style={eqS.title}>בנה/י תרגיל מהקוביות</Text>
      {!isSolved && <Text style={{color:'#6B7280',fontSize:10,textAlign:'center'}}>לחץ/י על קובייה כדי למקם אותה</Text>}

      {/* Dice pool: 3 tappable dice buttons */}
      {!isSolved && (
        <View style={eqS.diceRow}>
          {diceValues.map((dv, dIdx) => {
            const isUsed = usedDice.has(dIdx);
            return (
              <TouchableOpacity key={dIdx} onPress={() => hDice(dIdx)} activeOpacity={0.7}
                style={[eqS.diceBtn, isUsed && eqS.diceBtnUsed]}>
                <Text style={[eqS.diceBtnT, isUsed && eqS.diceBtnUsedT]}>{dv}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Equation row: slot — op — slot — op — slot */}
      <View style={eqS.eqR}>
        {[0,1,2].map(i => (
          <React.Fragment key={i}>
            {i > 0 && (
              <TouchableOpacity onPress={() => cycleOp(i-1)} activeOpacity={0.5}
                style={[eqS.opTouchWrap, eqS.opC, ops[i-1] === '' ? eqS.opEmpty : eqS.opDefault]}>
                {ops[i-1] !== '' && <Text style={eqS.opDefaultT}>{ops[i-1]}</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[eqS.slot, slots[i] !== null ? eqS.slotFilled : eqS.slotEmpty]}
              onPress={() => hSlot(i)} activeOpacity={0.7} disabled={isSolved}>
              {slots[i] !== null
                ? <Text style={eqS.slotVal}>{diceValues[slots[i]!]}</Text>
                : null}
            </TouchableOpacity>
          </React.Fragment>
        ))}
        {/* Result after slots */}
        {active.length >= 2 && cr !== null && Number.isFinite(cr) && (
          <>
            <Text style={eqS.eqEqualSign}>=</Text>
            <Text style={[eqS.eqResultNum, ok && {color:'#4ADE80'}]}>{cr}</Text>
          </>
        )}
      </View>

      {/* Solved phase: show green instruction below equation */}
      {isSolved && state.equationResult !== null && !state.hasPlayedCards && (
        <View style={{alignItems:'center',gap:6}}>
          <Text style={{color:'#4ADE80',fontSize:15,fontWeight:'800',textAlign:'center'}}>
            ✅ בחר קלפים שסכומם {state.equationResult}
          </Text>
        </View>
      )}

      {/* Confirm button — only in building phase */}
      {!isSolved && (
        <TouchableOpacity onPress={hConfirm} disabled={!ok} activeOpacity={0.7}>
          <LinearGradient colors={ok?['#22C55E','#15803D']:['#4B5563','#374151']} style={[eqS.cBtn, !ok&&{opacity:0.5}]}><Text style={eqS.cT}>בחר קלפים</Text></LinearGradient>
        </TouchableOpacity>
      )}

      {/* Possible results toggle */}
      {!isSolved && state.validTargets.length>0 && (
        <View style={{width:'100%',alignItems:'flex-start'}}>
          <TouchableOpacity onPress={()=>setResultsOpen(o=>!o)} activeOpacity={0.7} style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <Text style={eqS.hint}>{resultsOpen ? '▼' : '▶'} תוצאות אפשריות</Text>
          </TouchableOpacity>
          {resultsOpen && (
            <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-start',gap:6,marginTop:6}}>
              {state.validTargets.map(t => {
                const v = t.result;
                const cp = state.players[state.currentPlayerIndex];
                const hasCard = cp?.hand.some(c => c.type === 'number' && c.value === v);
                const color = hasCard ? (v <= 9 ? '#4ADE80' : v <= 19 ? '#FACC15' : '#60A5FA') : '#6B7280';
                return <Text key={v} style={{color, fontSize:11, fontWeight: hasCard ? '700' : '400'}}>{v}</Text>;
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const eqS = StyleSheet.create({
  wrap:{backgroundColor:'transparent',borderRadius:0,padding:14,alignItems:'center',gap:10,borderWidth:0,borderColor:'transparent'},
  title:{color:'#93C5FD',fontSize:15,fontWeight:'800',textAlign:'center'},
  diceRow:{flexDirection:'row',gap:12,justifyContent:'center',direction:'ltr' as any},
  diceBtn:{width:52,height:52,borderRadius:12,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#3B82F6',...Platform.select({ios:{shadowColor:'#3B82F6',shadowOffset:{width:0,height:2},shadowOpacity:0.3,shadowRadius:4},android:{elevation:4}})},
  diceBtnUsed:{backgroundColor:'rgba(55,65,81,0.4)',borderColor:'#4B5563',opacity:0.4,...Platform.select({ios:{shadowOpacity:0},android:{elevation:0}})},
  diceBtnT:{fontSize:24,fontWeight:'900',color:'#1F2937'},
  diceBtnUsedT:{color:'#6B7280'},
  eqR:{flexDirection:'row',direction:'ltr' as any,alignItems:'center',gap:6,justifyContent:'center'},
  slot:{width:SLOT_SZ,height:SLOT_SZ,borderRadius:10,alignItems:'center',justifyContent:'center'},
  slotFilled:{backgroundColor:'#FFF',borderWidth:2,borderColor:'#3B82F6'},
  slotEmpty:{borderWidth:2,borderStyle:'dashed' as any,borderColor:'rgba(255,255,255,0.3)',backgroundColor:'rgba(55,65,81,0.25)'},
  slotVal:{fontSize:22,fontWeight:'900',color:'#1F2937'},
  opTouchWrap:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  opC:{width:OP_SZ,height:OP_SZ,borderRadius:OP_SZ/2,alignItems:'center',justifyContent:'center'},
  opDefault:{backgroundColor:'rgba(75,85,99,0.5)'},
  opDefaultT:{fontSize:26,fontWeight:'900',color:'#F9A825'},
  opEmpty:{backgroundColor:'rgba(55,65,81,0.25)',borderWidth:1.5,borderStyle:'dashed' as any,borderColor:'#4B5563'},
  eqEqualSign:{fontSize:28,fontWeight:'900',color:'#FFD700',marginLeft:6},
  eqResultNum:{fontSize:24,fontWeight:'900',color:'#FFD700',marginLeft:4},
  cBtn:{paddingHorizontal:20,paddingVertical:12,borderRadius:10,alignItems:'center',justifyContent:'center'},
  cT:{color:'#FFF',fontSize:15,fontWeight:'700'},
  hint:{color:'#6B7280',fontSize:11,textAlign:'center'},
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
      {opCh && !hasFracDefense && <View style={aS.opS}><Text style={aS.opT}>אתגר פעולה: {state.activeOperation}</Text><Text style={aS.opH}>הגן/י עם קלף פעולה תואם או ג'וקר.</Text><Btn variant="danger" size="sm" onPress={()=>dispatch({type:'END_TURN'})}>קבל/י עונש</Btn></View>}
      {(bl||so)&&!hp&&!hasFracDefense && <View style={{flexDirection:'row',gap:8}}><Btn variant="secondary" size="sm" onPress={()=>dispatch({type:'DRAW_CARD'})}>שלוף קלף (ויתור)</Btn></View>}
      {(pr||bl||so)&&hp&&!hasFracDefense && <View style={{flexDirection:'row',gap:8}}><Btn variant="secondary" onPress={()=>dispatch({type:'END_TURN'})}>סיים תור</Btn></View>}
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
const aS = StyleSheet.create({ opS:{backgroundColor:'transparent',borderWidth:0,borderColor:'transparent',borderRadius:0,padding:12}, opT:{color:'#FDBA74',fontSize:13,fontWeight:'600',marginBottom:4}, opH:{color:'#9CA3AF',fontSize:11,marginBottom:8}, msg:{backgroundColor:'rgba(234,179,8,0.1)',borderRadius:10,padding:10,alignItems:'center'}, msgT:{color:'#FDE68A',fontSize:13,textAlign:'center'} });

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
    console.log('CARD TAP', card.id, card.type, card.type==='operation'?card.operation:'', 'phase=', state.phase, 'hp=', state.hasPlayedCards, 'activeOp=', state.activeOperation);
    if (state.hasPlayedCards) { console.log('BLOCKED: hasPlayedCards'); return; }

    // ── Fraction defense: ONLY solve (number) or block (fraction) allowed ──
    if (hasFracDefense) {
      if (card.type === 'number' && card.value === state.pendingFractionTarget) {
        dispatch({ type: 'DEFEND_FRACTION_SOLVE', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      return;
    }

    if (pr) {
      if (opCh) { if(card.type==='operation'&&card.operation===state.activeOperation) dispatch({type:'PLAY_OPERATION',card}); else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card}); return; }
      if (state.consecutiveIdenticalPlays < 2 && validateIdenticalPlay(card,td)) dispatch({type:'PLAY_IDENTICAL',card}); return;
    }
    if (bl) {
      // Building phase: fraction, joker only (operators cycle locally in equation)
      if(card.type==='fraction') dispatch({type:'PLAY_FRACTION',card});
      else if(card.type==='joker') dispatch({type:'OPEN_JOKER_MODAL',card});
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

  const stagedSum = so ? state.stagedCards.filter(c=>c.type==='number').reduce((s,c)=>s+(c.value??0),0) : 0;
  const target = state.equationResult;
  const sumMatches = so && target !== null && stagedSum === target && state.stagedCards.length > 0;

  return (
    <View style={{width:'100%'}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8}}>
        <Text style={{color:'#D1D5DB',fontSize:13,fontWeight:'600'}}>היד של {cp.name}</Text>
        <Text style={{color:'#6B7280',fontSize:11}}>({cp.hand.length} קלפים)</Text>
        {so && target !== null && !state.hasPlayedCards && (
          <View style={{flexDirection:'row',alignItems:'center',gap:4,marginLeft:'auto',backgroundColor:'rgba(34,197,94,0.15)',borderRadius:8,paddingHorizontal:8,paddingVertical:3}}>
            <Text style={{color:'#86EFAC',fontSize:11,fontWeight:'600'}}>יעד:</Text>
            <Text style={{color:'#FFF',fontSize:14,fontWeight:'900'}}>{target}</Text>
            {state.stagedCards.length > 0 && <Text style={{color: sumMatches ? '#4ADE80' : '#FCA5A5',fontSize:11,fontWeight:'700'}}> ({stagedSum})</Text>}
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingHorizontal:4,paddingBottom:4}}>
        {sorted.map(card => {
          const isStaged = state.stagedCards.some(c => c.id === card.id);
          const isIdentical = pr && !state.hasPlayedCards && state.consecutiveIdenticalPlays < 2 && td && validateIdenticalPlay(card, td);
          return (
            <View key={card.id} style={[
              isIdentical && {borderWidth:2,borderColor:'#F59E0B',borderRadius:12,...Platform.select({ios:{shadowColor:'#F59E0B',shadowOffset:{width:0,height:0},shadowOpacity:0.7,shadowRadius:10},android:{elevation:10}})},
              isStaged && {borderWidth:3,borderColor:'#FFD700',borderRadius:12,transform:[{translateY:-10}],...Platform.select({ios:{shadowColor:'#FFD700',shadowOffset:{width:0,height:0},shadowOpacity:0.8,shadowRadius:8},android:{elevation:12}})}
            ]}>
              <GameCard card={card} selected={isStaged} small onPress={()=>tap(card)} />
              {isStaged && <View style={{position:'absolute',top:-6,right:-6,width:20,height:20,borderRadius:10,backgroundColor:'#FFD700',alignItems:'center',justifyContent:'center',zIndex:10}}><Text style={{color:'#000',fontSize:12,fontWeight:'900'}}>✓</Text></View>}
            </View>
          );
        })}
      </ScrollView>
      {so && !state.hasPlayedCards && state.stagedCards.length > 0 && (
        <TouchableOpacity onPress={()=>dispatch({type:'CONFIRM_STAGED'})} activeOpacity={0.7} style={{marginTop:8}}>
          <LinearGradient colors={sumMatches ? ['#22C55E','#15803D'] : ['#3B82F6','#1D4ED8']} style={{paddingVertical:10,borderRadius:10,alignItems:'center'}}>
            <Text style={{color:'#FFF',fontSize:15,fontWeight:'700'}}>הנח קלפים</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      {so && !state.hasPlayedCards && (
        <TouchableOpacity onPress={()=>dispatch({type:'REVERT_TO_BUILDING'})} activeOpacity={0.7} style={{marginTop:6,alignItems:'center'}}>
          <Text style={{color:'#93C5FD',fontSize:13,fontWeight:'600',textDecorationLine:'underline'}}>חזרה לתרגיל</Text>
        </TouchableOpacity>
      )}
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
          {['כל שחקן מקבל 10 קלפים. הראשון שמרוקן את היד — מנצח!','הטל 3 קוביות וצור מספר יעד באמצעות חשבון (הקובייה השלישית אופציונלית).','בחר/י קלפי מספר מהיד שסכומם שווה לתוצאת המשוואה — ולחצ/י אשר.','לפני הטלת קוביות: אם יש קלף תואם לערימה — לחץ עליו לסיום תור.','קלפי שבר (1/2, 1/3, 1/4, 1/5): מחלקים את הקלף העליון ומכריחים את היריב להגן.','כשנותר 1-2 קלפים — לחץ "לולוס!" לפני שתסיים, אחרת תשלוף עונשין.','🔄 קלף זהה: אפשר להניח קלף זהה לערימה ולדלג על הקוביות. מוגבל לפעמיים ברצף!'].map((r,i) => <Text key={i} style={ssS.rItem}>{i+1}. {r}</Text>)}
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

function PlayerSidebar() {
  const { state } = useGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesTab, setRulesTab] = useState<'basic'|'attacks'|'special'>('basic');

  const rulesBasic = [
    'כל שחקן מקבל 10 קלפים. הראשון שמרוקן את היד — מנצח!',
    'הטל 3 קוביות וצור מספר יעד באמצעות חשבון (הקובייה השלישית אופציונלית).',
    'בחר/י קלפי מספר מהיד שסכומם שווה לתוצאת המשוואה — ולחצ/י אשר.',
    'לפני הטלת קוביות: אם יש קלף תואם לערימה — לחץ עליו לסיום תור.',
    'כשנותר 1-2 קלפים — לחץ "לולוס!" לפני שתסיים, אחרת תשלוף עונשין.',
  ];
  const rulesAttacks = [
    'קלפי שבר (1/2, 1/3, 1/4, 1/5): מחלקים את הקלף העליון ומכריחים את היריב להגן.',
    'הגנה מהתקפת שבר: הנח קלף מספר בדיוק בערך הנדרש, או חסום עם שבר נוסף.',
    'אם אין הגנה — שלוף קלפי עונשין (מספר = המכנה של השבר).',
    'קלפי פעולה (+, -, x, ÷): מכריחים את השחקן הבא להגן עם קלף פעולה תואם או ג\'וקר.',
  ];
  const rulesSpecial = [
    'קלף זהה: אפשר להניח קלף זהה לערימה ולדלג על הקוביות. מוגבל לפעמיים ברצף!',
    'ג\'וקר: בחר/י פעולה כרצונך — מגן מכל התקפה ומאתגר את השחקן הבא.',
    'שלישייה בקוביות: כל שאר השחקנים שולפים קלפים כמספר הקובייה!',
    'אם אין קלפים להניח — שלוף קלף מהחבילה (ויתור על תור).',
  ];

  const tabContent = rulesTab === 'basic' ? rulesBasic : rulesTab === 'attacks' ? rulesAttacks : rulesSpecial;

  return (
    <>
      <View style={sbS.wrap}>
        {state.players.map((p, i) => (
          <View key={p.id} style={[sbS.tab, i === state.currentPlayerIndex && sbS.tabActive]}>
            <Text style={[sbS.tabName, i === state.currentPlayerIndex && sbS.tabNameActive]} numberOfLines={1}>{p.name}</Text>
            <Text style={[sbS.tabCount, i === state.currentPlayerIndex && sbS.tabCountActive]}>{p.hand.length}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => setRulesOpen(true)} activeOpacity={0.7}>
          <LinearGradient colors={['#1E88E5','#1565C0']} style={sbS.rulesBtn}>
            <Text style={sbS.rulesBtnT}>📖 חוקים</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <AppModal visible={rulesOpen} onClose={() => setRulesOpen(false)} title="חוקי לולוס">
        <View style={{gap:12}}>
          <View style={{flexDirection:'row',gap:6,justifyContent:'center'}}>
            {([['basic','בסיסי'],['attacks','התקפות'],['special','מיוחד']] as const).map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => setRulesTab(key)} activeOpacity={0.7}
                style={{paddingHorizontal:14,paddingVertical:6,borderRadius:8,backgroundColor: rulesTab===key ? '#2563EB' : '#374151'}}>
                <Text style={{color: rulesTab===key ? '#FFF' : '#9CA3AF',fontSize:13,fontWeight:'700'}}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{gap:8}}>
            {tabContent.map((r, i) => (
              <Text key={i} style={{color:'#D1D5DB',fontSize:13,lineHeight:20,textAlign:'right'}}>{i+1}. {r}</Text>
            ))}
          </View>
        </View>
      </AppModal>
    </>
  );
}
const sbS = StyleSheet.create({
  wrap:{position:'absolute',top:56,right:8,flexDirection:'column',gap:5,zIndex:50,width:100},
  tab:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:10,paddingHorizontal:10,paddingVertical:6,borderWidth:1,borderColor:'rgba(255,255,255,0.15)'},
  tabActive:{backgroundColor:'#2E7D32',borderColor:'#66BB6A'},
  tabName:{color:'rgba(255,255,255,0.5)',fontSize:11,fontWeight:'700',maxWidth:60},
  tabCount:{color:'#6B7280',fontSize:11,fontWeight:'700'},
  tabNameActive:{color:'#FFF',fontWeight:'700' as any},
  tabCountActive:{color:'#C8E6C9'},
  rulesBtn:{borderRadius:20,paddingVertical:6,paddingHorizontal:12,alignItems:'center',borderWidth:1.5,borderColor:'#42A5F5',...Platform.select({ios:{shadowColor:'rgba(33,150,243,0.3)',shadowOffset:{width:0,height:2},shadowOpacity:1,shadowRadius:4},android:{elevation:4}})},
  rulesBtnT:{color:'#FFF',fontSize:11,fontWeight:'700'},
});

function MoveToast() {
  const { state, dispatch } = useGame();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.lastMoveMessage) {
      setText(state.lastMoveMessage);
      setVisible(true);
      translateY.setValue(40);
      opacity.setValue(0);
      // Slide up + fade in
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      // Auto-dismiss after 4s
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setVisible(false);
          dispatch({ type: 'CLEAR_TOAST' });
        });
      }, 4000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.lastMoveMessage]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', bottom: 110, left: 16, right: 16,
      transform: [{ translateY }], opacity,
      backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center',
      zIndex: 999,
    }}>
      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{text}</Text>
    </Animated.View>
  );
}

function GameScreen() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  const [showCel,setShowCel] = useState(false);
  const prevJ = useRef(state.jokerModalOpen);
  useEffect(() => { if(prevJ.current&&!state.jokerModalOpen&&state.hasPlayedCards) setShowCel(true); prevJ.current=state.jokerModalOpen; }, [state.jokerModalOpen,state.hasPlayedCards]);
  const td = state.discardPile[state.discardPile.length - 1];
  return (
    <LinearGradient colors={['#0F172A','#1E293B']} style={{flex:1,paddingTop:50}}>
      <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingBottom:8,gap:10}}>
        <TouchableOpacity style={{backgroundColor:'#DC2626',paddingHorizontal:14,paddingVertical:6,borderRadius:8}} onPress={()=>dispatch({type:'RESET_GAME'})}><Text style={{color:'#FFF',fontSize:13,fontWeight:'700'}}>יציאה</Text></TouchableOpacity>
        <Text style={{color:'#F59E0B',fontSize:20,fontWeight:'900',letterSpacing:2,flex:1,textAlign:'center'}}>לולוס</Text>
        <View style={{width:13}} />
      </View>
      <PlayerSidebar />
      <ScrollView style={{flex:1}} contentContainerStyle={{padding:12,paddingRight:116,gap:14,paddingBottom:20}} showsVerticalScrollIndicator={false}>

        {/* ── Fraction Attack Warning Banner ── */}
        {state.pendingFractionTarget !== null && (
          <LinearGradient colors={['#7C2D12','#9A3412']} style={{borderRadius:12,padding:14,borderWidth:2,borderColor:'#F97316',alignItems:'center',gap:6}}>
            <Text style={{color:'#FFF',fontSize:22,fontWeight:'900'}}>⚠️ אותגרת!</Text>
            <Text style={{color:'#FDE68A',fontSize:16,fontWeight:'700',textAlign:'center'}}>
              הנח קלף {state.pendingFractionTarget} או חסום עם שבר
            </Text>
            <Text style={{color:'#FDBA74',fontSize:12,textAlign:'center'}}>
              עונש: שליפת {state.fractionPenalty} קלפים
            </Text>
            <Btn variant="danger" size="sm" onPress={()=>dispatch({type:'DEFEND_FRACTION_PENALTY'})}>{`שלוף ${state.fractionPenalty} קלפי עונשין`}</Btn>
          </LinearGradient>
        )}

        {/* ── Dice + Deck side by side (RTL: first child = right) ── */}
        <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
          <View style={{alignItems:'center',gap:4}}>
            <DiscardPile />
            <Text style={{color:'#6B7280',fontSize:10}}>{state.drawPile.length} בחבילה</Text>
          </View>
          <View style={{flex:1,alignItems:'center'}}><DiceArea /></View>
        </View>

        <EquationBuilder /><StagingZone /><ActionBar />
      </ScrollView>
      <View style={{backgroundColor:'transparent',paddingHorizontal:12,paddingVertical:10,paddingBottom:24,borderTopWidth:0,borderTopColor:'transparent'}}><PlayerHand /></View>
      {showCel && <CelebrationFlash onDone={()=>setShowCel(false)} />}
      {/* Identical card play warning modal (red theme) */}
      <RNModal visible={!!state.identicalAlert} transparent animationType="fade" onRequestClose={() => dispatch({type:'DISMISS_IDENTICAL_ALERT'})}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'center',alignItems:'center',padding:24}}>
          <View style={{backgroundColor:'#1C1014',borderRadius:20,padding:28,width:'88%',alignItems:'center',borderWidth:2,borderColor:'#E74C3C'}}>
            <Text style={{fontSize:40,marginBottom:8}}>🔄</Text>
            <Text style={{color:'#E74C3C',fontSize:22,fontWeight:'900',marginBottom:10,textAlign:'center'}}>קלף זהה!</Text>
            <Text style={{color:'#FCA5A5',fontSize:16,fontWeight:'700',textAlign:'center',lineHeight:26,marginBottom:6}}>
              {state.identicalAlert?.playerName} הניח קלף זהה ({state.identicalAlert?.cardDisplay}) — דילוג על קוביות!
            </Text>
            {state.identicalAlert?.consecutive === 1 && (
              <Text style={{color:'#FDBA74',fontSize:14,textAlign:'center',marginBottom:14}}>נותר עוד שימוש אחד בקלף זהה</Text>
            )}
            {(state.identicalAlert?.consecutive ?? 0) >= 2 && (
              <View style={{backgroundColor:'rgba(231,76,60,0.15)',borderRadius:10,padding:10,marginBottom:14,borderWidth:1,borderColor:'rgba(231,76,60,0.3)'}}>
                <Text style={{color:'#EF4444',fontSize:14,fontWeight:'800',textAlign:'center'}}>⚠️ זה השימוש האחרון! השחקן הבא חייב להטיל קוביות</Text>
              </View>
            )}
            <TouchableOpacity style={{backgroundColor:'#E74C3C',borderRadius:12,paddingHorizontal:32,paddingVertical:12}} onPress={() => dispatch({type:'DISMISS_IDENTICAL_ALERT'})}>
              <Text style={{color:'#FFF',fontSize:16,fontWeight:'700'}}>הבנתי!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>
      <MoveToast />
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
  const [fontsLoaded] = useFonts({ Fredoka_700Bold });
  if (!fontsLoaded) return null;
  return <GameProvider><StatusBar style="light" /><GameRouter /></GameProvider>;
}

registerRootComponent(App);
