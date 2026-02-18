export type CardType = 'number' | 'fraction' | 'operation' | 'joker'
export type Operation = '+' | '-' | 'x' | '÷'
export type Fraction = '1/2' | '1/3' | '1/4' | '1/5'

export interface Card {
  id: string
  type: CardType
  value?: number
  fraction?: Fraction
  operation?: Operation
}

export interface Player {
  id: number
  name: string
  hand: Card[]
  calledLolos: boolean
}

export interface DiceResult {
  die1: number
  die2: number
  die3: number
}

export type GamePhase =
  | 'setup'
  | 'turn-transition'
  | 'roll-dice'
  | 'select-cards'
  | 'declare-equation'
  | 'game-over'

export interface GameState {
  phase: GamePhase
  players: Player[]
  currentPlayerIndex: number
  drawPile: Card[]
  discardPile: Card[]
  dice: DiceResult | null
  selectedCards: Card[]
  equation: string
  identicalPlayCount: number
  activeFraction: Fraction | null
  activeOperation: Operation | null
  winner: Player | null
  turnTimer: number | null
  message: string
  targetNumber: number | null
  validTargets: EquationOption[]
  jokerModalOpen: boolean
  difficulty: 'easy' | 'full'
  hasPlayedCards: boolean
  hasDrawnCard: boolean
}

export interface EquationOption {
  equation: string
  result: number
}

export type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full' }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE' }
  | { type: 'SELECT_CARD'; card: Card }
  | { type: 'PLAY_CARDS' }
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
  | { type: 'RESET_GAME' }
