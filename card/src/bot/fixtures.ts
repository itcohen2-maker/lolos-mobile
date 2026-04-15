// src/bot/fixtures.ts
//
// Fixture helpers for botBrain unit tests (M3).
//
// IMPORTANT: Does NOT import from '../../index' — that export is added in M4.5.
// The GameState/Card/Player types are imported from src/bot/types.ts which
// re-exports (or mirrors) the shapes needed. If types.ts does not re-export
// GameState, import the types from the local type definitions below.
//
// The baseline object is a copy of initialState from survey doc §15.
// If the live initialState changes, M4.5 integration tests will catch drift.

import type { BotDifficulty } from './types';

// ─── Minimal inline types ────────────────────────────────────────────────────
// botBrain.ts imports GameState from '../../index', but tests cannot do the
// same until M4.5. We re-declare only the fields the tests and brain need.
// TypeScript structural typing ensures these satisfy the real GameState shape
// as long as all required fields are present.

export type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
export type Operation = '+' | '-' | 'x' | '÷';
export type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

export interface Card {
  id: string;
  type: CardType;
  value?: number;
  fraction?: Fraction;
  operation?: Operation;
  resolvedValue?: number;
  resolvedTarget?: number;
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  calledLolos: boolean;
  isBot?: boolean; // added in M5; optional here so fixtures compile pre-M5
}

export interface EquationOption {
  equation: string;
  result: number;
}

// Full GameState shape (all fields from survey doc §2 plus M5 additions).
// Fields added in M5 (botConfig, botTickSeq) are optional here so fixtures
// compile against both the pre-M5 and post-M5 GameState.
export interface GameState {
  phase: 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'roll-dice' | 'game-over';
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: null | [number, number, number];
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
  identicalAlert: null | { playerName: string; cardDisplay: string; consecutive: number };
  jokerModalOpen: boolean;
  equationHandSlots: [null | unknown, null | unknown];
  equationHandPick: null | unknown;
  lastMoveMessage: string | null;
  lastDiscardCount: number;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  diceMode: '3';
  showFractions: boolean;
  showPossibleResults: boolean;
  showSolveExercise: boolean;
  difficultyStage: string;
  stageTransitions: number;
  mathRangeMax: 12 | 25;
  enabledOperators: Operation[];
  allowNegativeTargets: boolean;
  abVariant: string;
  equationAttempts: number;
  equationSuccesses: number;
  turnStartedAt: number | null;
  totalEquationResponseMs: number;
  timerSetting: '30' | '60' | 'off' | 'custom';
  timerCustomSeconds: number;
  winner: Player | null;
  message: string;
  roundsPlayed: number;
  notifications: unknown[];
  moveHistory: unknown[];
  guidanceEnabled: boolean | null;
  hasSeenIntroHint: boolean;
  hasSeenSolvedHint: boolean;
  soundsEnabled: boolean;
  tournamentTable: unknown[];
  possibleResultsInfoUses: number;
  possibleResultsInfoCountedThisTurn: boolean;
  suppressIdenticalOverlayOnline: boolean;
  // M5 additions (optional so tests compile before M5 lands):
  botConfig?: {
    difficulty: BotDifficulty;
    playerIds: ReadonlyArray<number>;
    rng?: () => number;
  } | null;
  botPendingStagedIds?: string[] | null;
  botPendingDemoActions?: unknown[] | null;
  botNoSolutionTicks?: number;
  botNoSolutionDrawPending?: boolean;
  botTickSeq?: number;
}

// ─── Baseline (mirrors initialState from index.tsx §15) ─────────────────────

const baseline: GameState = {
  phase: 'setup',
  players: [],
  currentPlayerIndex: 0,
  drawPile: [],
  discardPile: [],
  dice: null,
  selectedCards: [],
  stagedCards: [],
  validTargets: [],
  equationResult: null,
  equationOpsUsed: [],
  activeOperation: null,
  challengeSource: null,
  activeFraction: null,
  pendingFractionTarget: null,
  fractionPenalty: 0,
  fractionAttackResolved: false,
  hasPlayedCards: false,
  hasDrawnCard: false,
  lastCardValue: null,
  consecutiveIdenticalPlays: 0,
  identicalAlert: null,
  jokerModalOpen: false,
  equationHandSlots: [null, null],
  equationHandPick: null,
  lastMoveMessage: null,
  lastDiscardCount: 0,
  lastEquationDisplay: null,
  difficulty: 'full',
  diceMode: '3',
  showFractions: true,
  showPossibleResults: true,
  showSolveExercise: true,
  difficultyStage: 'H',
  stageTransitions: 7,
  mathRangeMax: 25,
  enabledOperators: ['x', '÷'],
  allowNegativeTargets: true,
  abVariant: 'control_0_12_plus',
  equationAttempts: 0,
  equationSuccesses: 0,
  turnStartedAt: null,
  totalEquationResponseMs: 0,
  timerSetting: 'off',
  timerCustomSeconds: 60,
  winner: null,
  message: '',
  roundsPlayed: 0,
  notifications: [],
  moveHistory: [],
  guidanceEnabled: null,
  hasSeenIntroHint: false,
  hasSeenSolvedHint: false,
  soundsEnabled: true,
  tournamentTable: [],
  possibleResultsInfoUses: 0,
  possibleResultsInfoCountedThisTurn: false,
  suppressIdenticalOverlayOnline: false,
  botConfig: null,
  botPendingStagedIds: null,
  botPendingDemoActions: null,
  botNoSolutionTicks: 0,
  botNoSolutionDrawPending: false,
  botTickSeq: 0,
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Build a test GameState starting from the initialState baseline and applying
 * the given overrides. Use object spread for nested arrays/objects as needed.
 */
export function makeFixtureState(overrides: Partial<GameState>): GameState {
  return { ...baseline, ...overrides };
}

/**
 * Build a Player fixture. Hand defaults to [].
 */
export function makePlayer(id: number, name: string, hand: Card[] = []): Player {
  return { id, name, hand, calledLolos: false };
}

let _cardSeq = 0;
/**
 * Build a Card fixture. Generates a unique id automatically.
 * Pass value for number cards, fraction for fraction cards,
 * operation for operation cards. Wild and joker cards need no extra fields.
 */
export function makeCard(
  type: CardType,
  value?: number,
  fraction?: Fraction,
  operation?: Operation,
): Card {
  _cardSeq += 1;
  const id = `test-card-${_cardSeq}`;
  return { id, type, value, fraction, operation };
}

/**
 * Reset the auto-incrementing card ID sequence. Call in beforeEach if
 * card IDs need to be stable across tests.
 */
export function resetCardSeq(): void {
  _cardSeq = 0;
}
