// ============================================================
// shared/types.ts — Lolos Card Game — Shared Types
// Used by both server and client
// ============================================================

import type { AppLocale, GameStatusMessage, LastMovePayload, LocalizedMessage } from './i18n';

// Re-export for consumers that share only types
export type { AppLocale, LocalizedMessage, LastMovePayload, GameStatusMessage };

// ── Card Types ──

export type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
export type Operation = '+' | '-' | 'x' | '÷';
export type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

export interface Card {
  id: string;
  type: CardType;
  value?: number;
  /** כש־type === 'wild' והקלף על הערימה — הערך שהוא מייצג (0–25). */
  resolvedValue?: number;
  fraction?: Fraction;
  operation?: Operation;
}

// ── Player Types ──

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  calledLolos: boolean;
  isConnected: boolean;
  isHost: boolean;
  afkWarnings: number;
  isEliminated: boolean;
  isSpectator: boolean;
  /** UI + server message language */
  locale: AppLocale;
}

/** What opponents see about a player (no hand details) */
export interface OpponentView {
  id: string;
  name: string;
  cardCount: number;
  isConnected: boolean;
  isHost: boolean;
  calledLolos: boolean;
  afkWarnings: number;
  isEliminated: boolean;
  isSpectator: boolean;
}

// ── Dice ──

export interface DiceResult {
  die1: number;
  die2: number;
  die3: number;
}

// ── Equation ──

export interface EquationOption {
  equation: string;
  result: number;
}

/** קלף פעולה/ג'וקר שהושם במשבצת בתרגיל הקוביות — מסונכרן לשרת במשחק מקוון */
export interface EquationCommitPayload {
  cardId: string;
  position: 0 | 1;
  /** כשהקלף ג'וקר — איזו פעולה נבחרה; אחרת null */
  jokerAs: Operation | null;
}

// ── Game Phase ──

export type GamePhase =
  | 'lobby'
  | 'turn-transition'
  | 'pre-roll'
  | 'building'
  | 'solved'
  | 'game-over';

/** הגדרות שמשתמש המארח קובע בתחילת משחק — משודרות לכל לקוח ב־PlayerView */
export interface HostGameSettings {
  /** תמיד 3 קוביות — אפשרות 2 הוסרה מהמוצר */
  diceMode: '3';
  showFractions: boolean;
  showPossibleResults: boolean;
  showSolveExercise: boolean;
  timerSetting: '30' | '60' | 'off' | 'custom';
  timerCustomSeconds: number;
}

// ── Server Game State (full, only on server) ──

export interface ServerGameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: DiceResult | null;
  validTargets: EquationOption[];
  equationResult: number | null;
  stagedCards: Card[];
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  /** לרוב null; מוגדר רק ב־state_update מיד אחרי playIdentical (מקוון) */
  identicalCelebration?: { playerName: string; cardDisplay: string; consecutive: number } | null;
  lastMoveMessage: LastMovePayload;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  hostGameSettings: HostGameSettings;
  winner: Player | null;
  message: GameStatusMessage;
  /** מזהה ייחודי למשחק מקוון — הגרלת פותח; לדה-דופליקציה של הודעה בלקוח */
  openingDrawId: string;
  /** מועד יעד (epoch ms) לפעולת התור הנוכחית — מקוון בלבד; null כשלא במצב המתנה */
  turnDeadlineAt: number | null;
  /** אחרי אישור תרגיל קוביות: קלף פעולה/ג'וקר ששולב בתרגיל ויוסר ביחד עם קלפי ההנחה */
  equationCommit: EquationCommitPayload | null;
}

// ── Client Player View (what each player sees) ──

export interface PlayerView {
  roomCode: string;
  phase: GamePhase;
  myHand: Card[];
  myPlayerId: string;
  opponents: OpponentView[];
  currentPlayerIndex: number;
  players: { id: string; name: string; cardCount: number; isConnected: boolean; isHost: boolean; calledLolos: boolean; afkWarnings: number; isEliminated: boolean; isSpectator: boolean }[];
  pileTop: Card | null;
  deckCount: number;
  dice: DiceResult | null;
  validTargets: EquationOption[];
  equationResult: number | null;
  stagedCards: Card[];
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  /** מגיע מהשרת רק בפריים אחרי קלף זהה מקוון — ממופה ל־identicalAlert בלקוח */
  identicalCelebration: { playerName: string; cardDisplay: string; consecutive: number } | null;
  lastMoveMessage: string | null;
  difficulty: 'easy' | 'full';
  gameSettings: HostGameSettings;
  winner: { id: string; name: string } | null;
  message: string;
  openingDrawId: string;
  turnDeadlineAt: number | null;
  /** נתון רק אחרי אישור תרגיל עם קלף פעולה/ג'וקר מהיד */
  equationCommit?: EquationCommitPayload | null;
}

// ── Socket Events: Client → Server ──

export interface ClientToServerEvents {
  create_room: (data: { playerName: string; locale?: AppLocale }) => void;
  join_room: (data: { roomCode: string; playerName: string; locale?: AppLocale }) => void;
  leave_room: () => void;
  start_game: (data: { difficulty: 'easy' | 'full'; gameSettings?: Partial<HostGameSettings> }) => void;
  roll_dice: () => void;
  set_operator: (data: { position: number; operator: string }) => void;
  confirm_equation: (data: { result: number; equationDisplay: string; equationCommit?: EquationCommitPayload | null }) => void;
  stage_card: (data: { cardId: string }) => void;
  unstage_card: (data: { cardId: string }) => void;
  confirm_staged: () => void;
  place_identical: (data: { cardId: string }) => void;
  play_fraction: (data: { cardId: string }) => void;
  defend_fraction_solve: (data: { cardId: string; wildResolve?: number }) => void;
  defend_fraction_penalty: () => void;
  play_operation: (data: { cardId: string }) => void;
  play_joker: (data: { cardId: string; chosenOperation: Operation }) => void;
  draw_card: () => void;
  call_lulos: () => void;
  end_turn: () => void;
  begin_turn: () => void;
  reconnect: (data: { roomCode: string; playerId: string; locale?: AppLocale }) => void;
}

// ── Socket Events: Server → Client ──

export interface ServerToClientEvents {
  room_created: (data: { roomCode: string; playerId: string }) => void;
  player_joined: (data: { players: { id: string; name: string; isHost: boolean; isConnected: boolean }[] }) => void;
  player_left: (data: { playerId: string; playerName: string }) => void;
  game_started: (data: PlayerView) => void;
  state_update: (data: PlayerView) => void;
  toast: (data: { message: string }) => void;
  error: (data: { message: string }) => void;
}
