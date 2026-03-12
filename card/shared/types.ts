// ============================================================
// shared/types.ts — Lolos Card Game — Shared Types
// Used by both server and client
// ============================================================

// ── Card Types ──

export type CardType = 'number' | 'fraction' | 'operation' | 'joker';
export type Operation = '+' | '-' | 'x' | '÷';
export type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

export interface Card {
  id: string;
  type: CardType;
  value?: number;
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
}

/** What opponents see about a player (no hand details) */
export interface OpponentView {
  id: string;
  name: string;
  cardCount: number;
  isConnected: boolean;
  isHost: boolean;
  calledLolos: boolean;
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

// ── Game Phase ──

export type GamePhase =
  | 'lobby'
  | 'turn-transition'
  | 'pre-roll'
  | 'building'
  | 'solved'
  | 'game-over';

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
  activeOperation: Operation | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  lastMoveMessage: string | null;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  winner: Player | null;
  message: string;
}

// ── Client Player View (what each player sees) ──

export interface PlayerView {
  roomCode: string;
  phase: GamePhase;
  myHand: Card[];
  myPlayerId: string;
  opponents: OpponentView[];
  currentPlayerIndex: number;
  players: { id: string; name: string; cardCount: number; isConnected: boolean; isHost: boolean; calledLolos: boolean }[];
  pileTop: Card | null;
  deckCount: number;
  dice: DiceResult | null;
  validTargets: EquationOption[];
  equationResult: number | null;
  stagedCards: Card[];
  activeOperation: Operation | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  lastMoveMessage: string | null;
  difficulty: 'easy' | 'full';
  winner: { id: string; name: string } | null;
  message: string;
}

// ── Socket Events: Client → Server ──

export interface ClientToServerEvents {
  create_room: (data: { playerName: string }) => void;
  join_room: (data: { roomCode: string; playerName: string }) => void;
  leave_room: () => void;
  start_game: (data: { difficulty: 'easy' | 'full' }) => void;
  roll_dice: () => void;
  set_operator: (data: { position: number; operator: string }) => void;
  confirm_equation: (data: { result: number; equationDisplay: string }) => void;
  stage_card: (data: { cardId: string }) => void;
  unstage_card: (data: { cardId: string }) => void;
  confirm_staged: () => void;
  place_identical: (data: { cardId: string }) => void;
  play_fraction: (data: { cardId: string }) => void;
  defend_fraction_solve: (data: { cardId: string }) => void;
  defend_fraction_penalty: () => void;
  play_operation: (data: { cardId: string }) => void;
  play_joker: (data: { cardId: string; chosenOperation: Operation }) => void;
  draw_card: () => void;
  call_lulos: () => void;
  end_turn: () => void;
  begin_turn: () => void;
  reconnect: (data: { roomCode: string; playerId: string }) => void;
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
