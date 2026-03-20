// ============================================================
// server/src/gameEngine.ts — Game state machine
// Migrated from client-side useReducer in index.tsx
// ============================================================

import type {
  Card, Player, ServerGameState, PlayerView, Operation, Fraction,
  DiceResult, HostGameSettings,
} from '../../shared/types';

const DEFAULT_HOST_GAME_SETTINGS: HostGameSettings = {
  diceMode: '3',
  showFractions: true,
  showPossibleResults: true,
  showSolveExercise: true,
  timerSetting: 'off',
  timerCustomSeconds: 60,
};
import { generateDeck, shuffle, dealCards } from './deck';
import {
  applyOperation, fractionDenominator, validateIdenticalPlay,
  validateFractionPlay, validateStagedCards,
  rollDice, isTriple, generateValidTargets,
} from './equations';
import type { Room } from './roomManager';

const CARDS_PER_PLAYER = 10;

// ── Helper: draw N cards from draw pile for a player ──

function reshuffleDiscard(st: ServerGameState): ServerGameState {
  if (st.drawPile.length > 0 || st.discardPile.length <= 1) return st;
  const top = st.discardPile[st.discardPile.length - 1];
  return { ...st, drawPile: shuffle(st.discardPile.slice(0, -1)), discardPile: [top] };
}

function drawFromPile(st: ServerGameState, count: number, pi: number): ServerGameState {
  let s = { ...st, players: st.players.map(p => ({ ...p, hand: [...p.hand] })) };
  for (let i = 0; i < count; i++) {
    s = reshuffleDiscard(s);
    if (s.drawPile.length === 0) break;
    s.players[pi].hand.push(s.drawPile[0]);
    s.drawPile = s.drawPile.slice(1);
  }
  return s;
}

// ── Check win condition ──

function checkWin(st: ServerGameState): ServerGameState {
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

// ── End turn logic ──

function endTurnLogic(st: ServerGameState): ServerGameState {
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
    stagedCards: [], equationResult: null, validTargets: [],
    activeOperation: keepOp ? s.activeOperation : null,
    hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
    pendingFractionTarget: null, fractionPenalty: 0,
  };
}

// ── Find a card in current player's hand ──

function findCard(state: ServerGameState, cardId: string): Card | undefined {
  const cp = state.players[state.currentPlayerIndex];
  return cp.hand.find(c => c.id === cardId);
}

// ══════════════════════════════════════════════════════════════
//  PUBLIC API — Game Actions
// ══════════════════════════════════════════════════════════════

export function startGame(
  room: Room,
  difficulty: 'easy' | 'full',
  partialSettings?: Partial<HostGameSettings>,
): ServerGameState {
  const hostGameSettings: HostGameSettings = {
    ...DEFAULT_HOST_GAME_SETTINGS,
    ...partialSettings,
  };
  const deck = shuffle(generateDeck(difficulty));
  const { hands, remaining } = dealCards(deck, room.players.length, CARDS_PER_PLAYER);
  let drawPile = remaining;

  // Find first number card for discard pile
  let firstDiscard: Card | undefined;
  for (let i = 0; i < drawPile.length; i++) {
    if (drawPile[i].type === 'number') {
      firstDiscard = drawPile[i];
      drawPile = [...drawPile.slice(0, i), ...drawPile.slice(i + 1)];
      break;
    }
  }
  if (!firstDiscard) { firstDiscard = drawPile[0]; drawPile = drawPile.slice(1); }

  // Deal hands to players
  const players: Player[] = room.players.map((p, i) => ({
    ...p,
    hand: hands[i],
    calledLolos: false,
  }));

  return {
    roomCode: room.code,
    phase: 'turn-transition',
    players,
    currentPlayerIndex: 0,
    drawPile,
    discardPile: firstDiscard ? [firstDiscard] : [],
    dice: null,
    validTargets: [],
    equationResult: null,
    stagedCards: [],
    activeOperation: null,
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: false,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    lastMoveMessage: null,
    lastEquationDisplay: null,
    difficulty,
    hostGameSettings,
    winner: null,
    message: '',
  };
}

export function beginTurn(st: ServerGameState): ServerGameState {
  if (st.activeOperation) {
    const cp = st.players[st.currentPlayerIndex];
    const has = cp.hand.some(c => (c.type === 'operation' && c.operation === st.activeOperation) || c.type === 'joker');
    if (has) return { ...st, phase: 'pre-roll', message: `פעולת ${st.activeOperation}! שחק/י קלף פעולה תואם או ג'וקר כדי להגן.` };
    let s = drawFromPile(st, 2, st.currentPlayerIndex);
    return { ...s, phase: 'pre-roll', activeOperation: null, message: `אין הגנה מפני ${st.activeOperation}! שלפת 2 קלפי עונשין.` };
  }
  if (st.pendingFractionTarget !== null && !st.fractionAttackResolved) {
    return { ...st, phase: 'pre-roll', message: `התקפת שבר! נדרש: ${st.pendingFractionTarget}. הגן/י בקלף מספר, חסום/י בשבר, או שלוף/י ${st.fractionPenalty} קלפים.` };
  }
  return { ...st, phase: 'pre-roll', fractionAttackResolved: false, pendingFractionTarget: null, fractionPenalty: 0, message: '' };
}

export function doRollDice(st: ServerGameState): ServerGameState | { error: string } {
  if (st.phase !== 'pre-roll') return { error: 'לא ניתן להטיל קוביות כעת' };
  const dice = rollDice();
  let ns: ServerGameState = { ...st, dice };

  if (isTriple(dice)) {
    let s = { ...ns, players: ns.players.map(p => ({ ...p, hand: [...p.hand] })) };
    for (let i = 0; i < s.players.length; i++)
      if (i !== st.currentPlayerIndex) s = drawFromPile(s, dice.die1, i);
    s.message = `שלישייה של ${dice.die1}! כל שאר השחקנים שולפים ${dice.die1} קלפים!`;
    ns = s;
  }

  const vt = generateValidTargets(dice);
  return { ...ns, validTargets: vt, phase: 'building', activeOperation: null, consecutiveIdenticalPlays: 0, message: ns.message || '' };
}

export function confirmEquation(st: ServerGameState, result: number, equationDisplay: string): ServerGameState | { error: string } {
  if (st.phase !== 'building') return { error: 'לא בשלב בניית תרגיל' };
  if (!st.validTargets.some(t => t.result === result)) return { error: 'תוצאה לא חוקית' };
  return { ...st, phase: 'solved', equationResult: result, lastEquationDisplay: equationDisplay, stagedCards: [], message: '' };
}

export function stageCard(st: ServerGameState, cardId: string): ServerGameState | { error: string } {
  if (st.phase !== 'solved' || st.hasPlayedCards) return { error: 'לא ניתן לשלב קלף כעת' };
  const card = findCard(st, cardId);
  if (!card) return { error: 'קלף לא נמצא' };
  if (st.stagedCards.some(c => c.id === card.id)) return { error: 'הקלף כבר באזור ההנחה' };
  if (card.type !== 'number' && card.type !== 'operation') return { error: 'ניתן לשלב רק קלפי מספר או פעולה' };
  if (card.type === 'operation' && st.stagedCards.some(c => c.type === 'operation')) {
    return { error: 'אפשר רק סימן פעולה אחד באזור ההנחה' };
  }
  return { ...st, stagedCards: [...st.stagedCards, card], message: '' };
}

export function unstageCard(st: ServerGameState, cardId: string): ServerGameState | { error: string } {
  if (st.phase !== 'solved') return { error: 'לא בשלב הנכון' };
  return { ...st, stagedCards: st.stagedCards.filter(c => c.id !== cardId), message: '' };
}

export function confirmStaged(st: ServerGameState): ServerGameState | { error: string } {
  if (st.phase !== 'solved' || st.hasPlayedCards) return { error: 'לא ניתן לאשר כעת' };
  const stNumbers = st.stagedCards.filter(c => c.type === 'number');
  const stOpCards = st.stagedCards.filter(c => c.type === 'operation');
  const stOpCard = stOpCards.length === 1 ? stOpCards[0] : null;
  if (stNumbers.length === 0) return { error: 'יש לבחור לפחות קלף מספר אחד' };
  if (st.equationResult === null) return { error: 'אין תוצאת תרגיל' };
  if (!validateStagedCards(stNumbers, stOpCard, st.equationResult)) {
    return { error: 'השילוב הזה לא מגיע לתוצאה, נסה לשנות' };
  }

  const stIds = new Set(st.stagedCards.map(c => c.id));
  const stCp = st.players[st.currentPlayerIndex];
  const stNp = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: stCp.hand.filter(c => !stIds.has(c.id)) } : p);
  const stDiscard = [...st.discardPile, ...stNumbers];
  if (stOpCard) stDiscard.push(stOpCard);

  const stNewActiveOp = stOpCard ? stOpCard.operation! : null;
  const stLastNum = stNumbers[stNumbers.length - 1];
  const stToast = stNewActiveOp
    ? `⚔️ ${stCp.name}: הניח סימן ${stNewActiveOp} — אתגר!`
    : `✅ ${stCp.name}: ${st.lastEquationDisplay || ''} → הניח ${stLastNum.value}`;

  let stNs: ServerGameState = {
    ...st, players: stNp, discardPile: stDiscard,
    stagedCards: [], consecutiveIdenticalPlays: 0,
    hasPlayedCards: true, lastCardValue: stLastNum.value ?? null,
    activeOperation: stNewActiveOp ?? st.activeOperation,
    lastMoveMessage: stToast, lastEquationDisplay: null,
    message: stNewActiveOp ? `אתגר פעולה ${stNewActiveOp} לשחקן הבא!` : '',
  };
  stNs = checkWin(stNs);
  if (stNs.phase === 'game-over') return stNs;
  return endTurnLogic(stNs);
}

export function playIdentical(st: ServerGameState, cardId: string): ServerGameState | { error: string } {
  if (st.phase !== 'pre-roll') return { error: 'לא בשלב הנכון' };
  if (st.consecutiveIdenticalPlays >= 2) return { error: 'חריגה ממגבלת קלף זהה' };
  const card = findCard(st, cardId);
  if (!card) return { error: 'קלף לא נמצא' };
  const td = st.discardPile[st.discardPile.length - 1];
  if (!validateIdenticalPlay(card, td)) return { error: 'הקלף לא זהה לקלף בראש הערימה' };

  const cp = st.players[st.currentPlayerIndex];
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  const newConsecutive = st.consecutiveIdenticalPlays + 1;
  const cardDisplay = card.type === 'number' ? `${card.value}` :
                      card.type === 'fraction' ? card.fraction! :
                      card.type === 'operation' ? card.operation! : 'ג׳וקר';
  const toast = `🔄 ${cp.name}: הניח קלף זהה (${cardDisplay}) — דילוג על קוביות`;

  let ns: ServerGameState = {
    ...st, players: np, discardPile: [...st.discardPile, card],
    hasPlayedCards: true,
    consecutiveIdenticalPlays: newConsecutive,
    lastCardValue: card.type === 'number' ? card.value ?? null : null,
    lastMoveMessage: toast, message: '',
  };
  ns = checkWin(ns);
  if (ns.phase === 'game-over') return ns;
  return endTurnLogic(ns);
}

export function playFraction(st: ServerGameState, cardId: string): ServerGameState | { error: string } {
  if (st.hasPlayedCards) return { error: 'כבר שיחקת קלף בתור הזה' };
  const card = findCard(st, cardId);
  if (!card || card.type !== 'fraction') return { error: 'קלף שבר לא נמצא' };
  const cp = st.players[st.currentPlayerIndex];
  const denom = fractionDenominator(card.fraction!);

  // ── BLOCK MODE: fraction-on-fraction during defense ──
  if (st.pendingFractionTarget !== null) {
    const newTarget = st.pendingFractionTarget / denom;
    const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
    let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, card], hasPlayedCards: true });
    if (ns.phase === 'game-over') return ns;
    const next = (ns.currentPlayerIndex + 1) % ns.players.length;
    return {
      ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
      currentPlayerIndex: next, phase: 'turn-transition', dice: null,
      stagedCards: [], equationResult: null, validTargets: [],
      activeOperation: null,
      consecutiveIdenticalPlays: 0,
      hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
      pendingFractionTarget: newTarget, fractionPenalty: denom,
      fractionAttackResolved: false,
      lastMoveMessage: `⚔️ ${cp.name}: חסם בשבר ${card.fraction} — אתגר!`,
      message: `${cp.name} חסם/ה בשבר ${card.fraction}!`,
    };
  }

  // ── ATTACK MODE: fraction on a number card ──
  if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') {
    return { error: 'לא ניתן לשחק שבר בשלב הזה' };
  }
  const td = st.discardPile[st.discardPile.length - 1];
  if (!validateFractionPlay(card, td)) return { error: 'לא ניתן לשחק שבר על הקלף הנוכחי' };
  const newTarget = td.value! / denom;
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  let ns = checkWin({ ...st, players: np, discardPile: [...st.discardPile, card], hasPlayedCards: true });
  if (ns.phase === 'game-over') return ns;
  const next = (ns.currentPlayerIndex + 1) % ns.players.length;
  return {
    ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    stagedCards: [], equationResult: null, validTargets: [],
    activeOperation: null,
    consecutiveIdenticalPlays: 0,
    hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
    pendingFractionTarget: newTarget, fractionPenalty: denom,
    fractionAttackResolved: false,
    lastMoveMessage: `⚔️ ${cp.name}: הניח שבר ${card.fraction} — אתגר!`,
    message: `${cp.name} שיחק/ה שבר ${card.fraction}!`,
  };
}

export function defendFractionSolve(st: ServerGameState, cardId: string): ServerGameState | { error: string } {
  if (st.pendingFractionTarget === null) return { error: 'אין התקפת שבר פעילה' };
  const card = findCard(st, cardId);
  if (!card || card.type !== 'number' || card.value !== st.pendingFractionTarget) {
    return { error: 'הקלף לא מתאים להגנה' };
  }
  const cp = st.players[st.currentPlayerIndex];
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  let ns = checkWin({
    ...st, players: np, discardPile: [...st.discardPile, card],
    pendingFractionTarget: null, fractionPenalty: 0,
    fractionAttackResolved: true, lastCardValue: card.value ?? null,
    message: 'הגנה מוצלחת!',
  });
  if (ns.phase === 'game-over') return ns;
  return { ...ns, phase: 'pre-roll', hasPlayedCards: false };
}

export function defendFractionPenalty(st: ServerGameState): ServerGameState | { error: string } {
  if (st.pendingFractionTarget === null) return { error: 'אין התקפת שבר פעילה' };
  const cp = st.players[st.currentPlayerIndex];
  let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
  s = {
    ...s,
    pendingFractionTarget: null, fractionPenalty: 0,
    fractionAttackResolved: true,
    lastMoveMessage: `📥 ${cp.name}: שלף ${st.fractionPenalty} קלפי עונשין`,
    message: `${cp.name} שלף/ה ${st.fractionPenalty} קלפי עונשין.`,
  };
  return endTurnLogic(s);
}

export function playOperation(st: ServerGameState, cardId: string): ServerGameState | { error: string } {
  if (st.phase !== 'pre-roll' && st.phase !== 'solved') return { error: 'לא בשלב הנכון' };
  if (st.hasPlayedCards) return { error: 'כבר שיחקת קלף' };
  const card = findCard(st, cardId);
  if (!card || card.type !== 'operation') return { error: 'קלף פעולה לא נמצא' };
  const cp = st.players[st.currentPlayerIndex];
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  let ns: ServerGameState = {
    ...st, players: np, discardPile: [...st.discardPile, card],
    activeOperation: card.operation!, hasPlayedCards: true, message: '',
  };
  ns = checkWin(ns);
  return ns;
}

export function playJoker(st: ServerGameState, cardId: string, chosenOperation: Operation): ServerGameState | { error: string } {
  const card = findCard(st, cardId);
  if (!card || card.type !== 'joker') return { error: 'קלף ג׳וקר לא נמצא' };
  const cp = st.players[st.currentPlayerIndex];
  const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== card.id) } : p);
  let ns: ServerGameState = {
    ...st, players: np, discardPile: [...st.discardPile, card],
    activeOperation: chosenOperation, hasPlayedCards: true, message: '',
  };
  ns = checkWin(ns);
  return ns;
}

export function drawCard(st: ServerGameState): ServerGameState | { error: string } {
  if (st.hasPlayedCards || st.hasDrawnCard) return { error: 'לא ניתן לשלוף קלף כעת' };
  const drawCp = st.players[st.currentPlayerIndex];
  let s = reshuffleDiscard(st);
  if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: '' };
  s = drawFromPile(s, 1, s.currentPlayerIndex);
  s = { ...s, hasDrawnCard: true, lastMoveMessage: `📥 ${drawCp.name}: שלף קלף מהחבילה` };
  return endTurnLogic(s);
}

export function callLulos(st: ServerGameState, playerId: string): ServerGameState | { error: string } {
  const pi = st.players.findIndex(p => p.id === playerId);
  if (pi === -1) return { error: 'שחקן לא נמצא' };
  const cp = st.players[pi];
  if (cp.hand.length > 2) return { error: 'יותר מדי קלפים לקריאת לולוס' };
  return {
    ...st,
    players: st.players.map((p, i) => i === pi ? { ...p, calledLolos: true } : p),
    message: `${cp.name} קרא/ה לולוס!`,
  };
}

export function doEndTurn(st: ServerGameState): ServerGameState {
  return endTurnLogic(st);
}

// ══════════════════════════════════════════════════════════════
//  PLAYER VIEW — what each player sees (hides other hands)
// ══════════════════════════════════════════════════════════════

export function getPlayerView(state: ServerGameState, playerId: string): PlayerView {
  const myPlayer = state.players.find(p => p.id === playerId);
  const pileTop = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: playerId,
    opponents: state.players
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        isConnected: p.isConnected,
        isHost: p.isHost,
        calledLolos: p.calledLolos,
      })),
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      isConnected: p.isConnected,
      isHost: p.isHost,
      calledLolos: p.calledLolos,
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    pileTop,
    deckCount: state.drawPile.length,
    dice: state.dice,
    validTargets: state.validTargets,
    equationResult: state.equationResult,
    stagedCards: state.stagedCards,
    activeOperation: state.activeOperation,
    pendingFractionTarget: state.pendingFractionTarget,
    fractionPenalty: state.fractionPenalty,
    fractionAttackResolved: state.fractionAttackResolved,
    hasPlayedCards: state.hasPlayedCards,
    hasDrawnCard: state.hasDrawnCard,
    lastCardValue: state.lastCardValue,
    consecutiveIdenticalPlays: state.consecutiveIdenticalPlays,
    lastMoveMessage: state.lastMoveMessage,
    difficulty: state.difficulty,
    gameSettings: state.hostGameSettings,
    winner: state.winner ? { id: state.winner.id, name: state.winner.name } : null,
    message: state.message,
  };
}
