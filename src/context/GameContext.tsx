import React, { createContext, useReducer, ReactNode } from 'react'
import { GameState, GameAction, Card } from '../types/game'
import { generateDeck, shuffle, dealCards } from '../utils/deck'
import { rollDice, isTriple, generateValidTargets } from '../utils/dice'
import {
  validateNumberCardPlay,
  validateIdenticalPlay,
  validateFractionPlay,
} from '../utils/validation'
import { applyFraction, isDivisibleByFraction } from '../utils/arithmetic'

const CARDS_PER_PLAYER = 10

const initialState: GameState = {
  phase: 'setup',
  players: [],
  currentPlayerIndex: 0,
  drawPile: [],
  discardPile: [],
  dice: null,
  selectedCards: [],
  equation: '',
  identicalPlayCount: 0,
  activeFraction: null,
  activeOperation: null,
  winner: null,
  turnTimer: null,
  message: '',
  targetNumber: null,
  validTargets: [],
  jokerModalOpen: false,
  difficulty: 'full',
  hasPlayedCards: false,
  hasDrawnCard: false,
}

function reshuffleDiscard(state: GameState): GameState {
  if (state.drawPile.length > 0) return state
  if (state.discardPile.length <= 1) return state
  const topCard = state.discardPile[state.discardPile.length - 1]
  const rest = state.discardPile.slice(0, -1)
  return {
    ...state,
    drawPile: shuffle(rest),
    discardPile: [topCard],
  }
}

function drawFromPile(state: GameState, count: number, playerIndex: number): GameState {
  let s = { ...state, players: state.players.map((p) => ({ ...p, hand: [...p.hand] })) }
  for (let i = 0; i < count; i++) {
    s = reshuffleDiscard(s)
    if (s.drawPile.length === 0) break
    const card = s.drawPile[0]
    s.drawPile = s.drawPile.slice(1)
    s.players[playerIndex].hand.push(card)
  }
  return s
}

function checkWin(state: GameState): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (currentPlayer.hand.length === 0 && currentPlayer.calledLolos) {
    return { ...state, phase: 'game-over', winner: currentPlayer }
  }
  if (currentPlayer.hand.length === 0 && !currentPlayer.calledLolos) {
    const s = drawFromPile(state, 1, state.currentPlayerIndex)
    if (s.players[state.currentPlayerIndex].hand.length === 0) {
      return { ...s, phase: 'game-over', winner: currentPlayer }
    }
    return {
      ...s,
      message: `${currentPlayer.name} שכח/ה לקרוא לולוס! שלף/י קלף אחד.`,
    }
  }
  return state
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const deck = shuffle(generateDeck(action.difficulty))
      const playerCount = action.players.length
      const { hands, remaining } = dealCards(deck, playerCount, CARDS_PER_PLAYER)
      const topCard = remaining[0]
      const drawPile = remaining.slice(1)

      const players = action.players.map((p, i) => ({
        id: i,
        name: p.name,
        hand: hands[i],
        calledLolos: false,
      }))

      return {
        ...initialState,
        phase: 'turn-transition',
        players,
        drawPile,
        discardPile: topCard ? [topCard] : [],
        difficulty: action.difficulty,
      }
    }

    case 'NEXT_TURN': {
      const nextIndex = (state.currentPlayerIndex + 1) % state.players.length
      const players = state.players.map((p) => ({ ...p, calledLolos: false }))
      return {
        ...state,
        players,
        currentPlayerIndex: nextIndex,
        phase: 'turn-transition',
        dice: null,
        selectedCards: [],
        equation: '',
        targetNumber: null,
        validTargets: [],
        message: '',
        activeOperation: null,
        hasPlayedCards: false,
        hasDrawnCard: false,
      }
    }

    case 'BEGIN_TURN': {
      if (state.activeOperation) {
        const op = state.activeOperation
        const currentPlayer = state.players[state.currentPlayerIndex]
        const hasCounter = currentPlayer.hand.some(
          (c) => (c.type === 'operation' && c.operation === op) || c.type === 'joker'
        )
        if (hasCounter) {
          return {
            ...state,
            phase: 'select-cards',
            message: `פעולת ${op}! שחק/י קלף פעולה תואם או ג'וקר כדי להגן, או סיים/י תור כדי לשלוף 2 קלפים.`,
          }
        } else {
          let s = drawFromPile(state, 2, state.currentPlayerIndex)
          return {
            ...s,
            phase: 'roll-dice',
            activeOperation: null,
            message: `אין הגנה מפני ${op}! שלפת 2 קלפי עונשין. עכשיו הטל/י קוביות.`,
          }
        }
      }
      return { ...state, phase: 'roll-dice', message: '' }
    }

    case 'ROLL_DICE': {
      const dice = rollDice()
      let newState: GameState = { ...state, dice }

      if (isTriple(dice)) {
        const penaltyCount = dice.die1
        const currentIdx = state.currentPlayerIndex
        let s = { ...newState, players: newState.players.map((p) => ({ ...p, hand: [...p.hand] })) }
        for (let i = 0; i < s.players.length; i++) {
          if (i !== currentIdx) {
            s = drawFromPile(s, penaltyCount, i)
          }
        }
        s.message = `שלישייה של ${dice.die1}! כל שאר השחקנים שולפים ${penaltyCount} קלפים!`
        newState = s
      }

      const validTargets = generateValidTargets(dice)
      return {
        ...newState,
        validTargets,
        phase: 'select-cards',
        message: newState.message || (validTargets.length === 0
          ? 'אין מספרים תקינים מהקוביות. שחק/י קלפים מיוחדים או שלוף/י.'
          : ''),
      }
    }

    case 'SELECT_CARD': {
      if (state.hasPlayedCards) return state
      const isSelected = state.selectedCards.some((c) => c.id === action.card.id)
      const selectedCards = isSelected
        ? state.selectedCards.filter((c) => c.id !== action.card.id)
        : [...state.selectedCards, action.card]
      return { ...state, selectedCards }
    }

    case 'PLAY_CARDS': {
      if (state.hasPlayedCards) {
        return { ...state, message: 'כבר שיחקת קלפים בתור הזה!' }
      }
      if (state.selectedCards.length === 0) {
        return { ...state, message: 'בחר/י לפחות קלף אחד לשחק!' }
      }
      const numberCards = state.selectedCards.filter((c) => c.type === 'number')
      if (numberCards.length !== state.selectedCards.length) {
        return { ...state, message: 'ניתן לשחק רק קלפי מספר בפעולה זו!' }
      }
      const cardSum = numberCards.reduce((s, c) => s + (c.value ?? 0), 0)
      const matchedTarget = state.validTargets.find((t) => t.result === cardSum)
      if (!matchedTarget) {
        const validNums = state.validTargets.map((t) => t.result).join(', ')
        return {
          ...state,
          message: `הסכום ${cardSum} לא תואם אף תוצאת קוביות. תקינים: ${validNums || 'אין'}`,
        }
      }

      const playedIds = new Set(state.selectedCards.map((c) => c.id))
      const currentPlayer = state.players[state.currentPlayerIndex]
      const newHand = currentPlayer.hand.filter((c) => !playedIds.has(c.id))
      const newDiscard = [...state.discardPile, ...state.selectedCards]

      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
      )

      let newState: GameState = {
        ...state,
        players: newPlayers,
        discardPile: newDiscard,
        selectedCards: [],
        identicalPlayCount: 0,
        targetNumber: null,
        hasPlayedCards: true,
        message: 'קלפים שוחקו! סיים/י את התור.',
      }

      newState = checkWin(newState)
      if (newState.phase === 'game-over') return newState

      return { ...newState, phase: 'select-cards' }
    }

    case 'CONFIRM_EQUATION': {
      if (state.hasPlayedCards) {
        return { ...state, message: 'כבר שיחקת קלפים בתור הזה!' }
      }
      if (state.selectedCards.length === 0) {
        return { ...state, message: 'בחר/י לפחות קלף אחד לשחק!' }
      }
      const eqNumberCards = state.selectedCards.filter((c) => c.type === 'number')
      if (eqNumberCards.length !== state.selectedCards.length) {
        return { ...state, message: 'ניתן לשחק רק קלפי מספר בפעולה זו!' }
      }
      const eqCardSum = eqNumberCards.reduce((s, c) => s + (c.value ?? 0), 0)

      // Strict validation: equation result must match card sum AND be a valid target
      if (action.equationResult !== eqCardSum) {
        return { ...state, message: 'המשוואה אינה נכונה או חסרה!' }
      }
      const eqMatchedTarget = state.validTargets.find((t) => t.result === action.equationResult)
      if (!eqMatchedTarget) {
        return { ...state, message: 'המשוואה אינה נכונה או חסרה!' }
      }

      const eqPlayedIds = new Set(state.selectedCards.map((c) => c.id))
      const eqCurrentPlayer = state.players[state.currentPlayerIndex]
      const eqNewHand = eqCurrentPlayer.hand.filter((c) => !eqPlayedIds.has(c.id))
      const eqNewDiscard = [...state.discardPile, ...state.selectedCards]

      const eqNewPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: eqNewHand } : p
      )

      let eqNewState: GameState = {
        ...state,
        players: eqNewPlayers,
        discardPile: eqNewDiscard,
        selectedCards: [],
        identicalPlayCount: 0,
        targetNumber: null,
        hasPlayedCards: true,
        message: 'קלפים שוחקו! סיים/י את התור.',
      }

      eqNewState = checkWin(eqNewState)
      if (eqNewState.phase === 'game-over') return eqNewState

      return { ...eqNewState, phase: 'select-cards' }
    }

    case 'PLAY_IDENTICAL': {
      if (state.hasPlayedCards) {
        return { ...state, message: 'כבר שיחקת קלפים בתור הזה!' }
      }
      const topDiscard = state.discardPile[state.discardPile.length - 1]
      if (!validateIdenticalPlay(action.card, topDiscard)) {
        return { ...state, message: 'הקלף לא תואם את הקלף העליון!' }
      }
      if (state.identicalPlayCount >= 2) {
        return { ...state, message: 'מקסימום 2 שחיקות זהות ברצף!' }
      }

      const currentPlayer = state.players[state.currentPlayerIndex]
      const newHand = currentPlayer.hand.filter((c) => c.id !== action.card.id)
      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
      )

      let newState: GameState = {
        ...state,
        players: newPlayers,
        discardPile: [...state.discardPile, action.card],
        identicalPlayCount: state.identicalPlayCount + 1,
        selectedCards: [],
        hasPlayedCards: true,
        message: 'קלף זהה שוחק! סיים/י את התור.',
      }

      newState = checkWin(newState)
      if (newState.phase === 'game-over') return newState

      return newState
    }

    case 'PLAY_OPERATION': {
      if (state.hasPlayedCards) {
        return { ...state, message: 'כבר שיחקת קלפים בתור הזה!' }
      }
      const currentPlayer = state.players[state.currentPlayerIndex]
      if (action.card.type !== 'operation') {
        return { ...state, message: 'זה לא קלף פעולה!' }
      }

      const newHand = currentPlayer.hand.filter((c) => c.id !== action.card.id)
      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
      )

      let newState: GameState = {
        ...state,
        players: newPlayers,
        discardPile: [...state.discardPile, action.card],
        activeOperation: action.card.operation!,
        selectedCards: [],
        hasPlayedCards: true,
        message: `שוחק קלף פעולה ${action.card.operation}! סיים/י את התור.`,
      }

      newState = checkWin(newState)
      return newState
    }

    case 'PLAY_FRACTION': {
      if (state.hasPlayedCards) {
        return { ...state, message: 'כבר שיחקת קלפים בתור הזה!' }
      }
      const topDiscard = state.discardPile[state.discardPile.length - 1]
      if (!validateFractionPlay(action.card, topDiscard)) {
        return { ...state, message: 'לא ניתן לשחק שבר זה על הקלף הנוכחי!' }
      }

      const currentPlayer = state.players[state.currentPlayerIndex]
      const newHand = currentPlayer.hand.filter((c) => c.id !== action.card.id)
      const topValue = topDiscard.value!
      const newValue = applyFraction(topValue, action.card.fraction!)
      const resultCard: Card = {
        id: `frac-result-${Date.now()}`,
        type: 'number',
        value: newValue,
      }

      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
      )

      const denom = action.card.fraction === '1/2' ? 2 : action.card.fraction === '1/3' ? 3 : action.card.fraction === '1/4' ? 4 : 5

      let newState: GameState = {
        ...state,
        players: newPlayers,
        discardPile: [...state.discardPile, action.card, resultCard],
        selectedCards: [],
        hasPlayedCards: true,
        message: `שוחק ${action.card.fraction}! ${topValue} ÷ ${denom} = ${newValue}. סיים/י את התור.`,
      }

      newState = checkWin(newState)
      return newState
    }

    case 'OPEN_JOKER_MODAL': {
      return { ...state, jokerModalOpen: true, selectedCards: [action.card] }
    }

    case 'CLOSE_JOKER_MODAL': {
      return { ...state, jokerModalOpen: false, selectedCards: [] }
    }

    case 'PLAY_JOKER': {
      const currentPlayer = state.players[state.currentPlayerIndex]
      const newHand = currentPlayer.hand.filter((c) => c.id !== action.card.id)
      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
      )

      let newState: GameState = {
        ...state,
        players: newPlayers,
        discardPile: [...state.discardPile, action.card],
        activeOperation: action.chosenOperation,
        selectedCards: [],
        jokerModalOpen: false,
        hasPlayedCards: true,
        message: `ג'וקר שוחק כ-${action.chosenOperation}! סיים/י את התור.`,
      }

      newState = checkWin(newState)
      return newState
    }

    case 'DRAW_CARD': {
      if (state.hasPlayedCards) {
        return { ...state, message: 'כבר שיחקת קלפים בתור הזה! סיים/י את התור.' }
      }
      let s = reshuffleDiscard(state)
      if (s.drawPile.length === 0) {
        return { ...s, hasDrawnCard: true, message: 'אין קלפים לשליפה!' }
      }
      s = drawFromPile(s, 1, s.currentPlayerIndex)
      return {
        ...s,
        hasDrawnCard: true,
        message: `נשלף קלף. (${s.players[s.currentPlayerIndex].hand.length} קלפים ביד)`,
      }
    }

    case 'CALL_LOLOS': {
      const currentPlayer = state.players[state.currentPlayerIndex]
      if (currentPlayer.hand.length !== 1) {
        return { ...state, message: 'ניתן לקרוא לולוס רק עם קלף אחד ביד!' }
      }
      const newPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, calledLolos: true } : p
      )
      return {
        ...state,
        players: newPlayers,
        message: `${currentPlayer.name} קרא/ה לולוס!`,
      }
    }

    case 'END_TURN': {
      let s = { ...state }
      let keepActiveOp = false

      // Operation penalty: only if player didn't counter (didn't play cards this turn)
      if (s.activeOperation && !state.hasPlayedCards) {
        s = drawFromPile(s, 2, s.currentPlayerIndex)
        s.message = `${state.players[state.currentPlayerIndex].name} קיבל/ה עונש ${state.activeOperation}! שלף/ה 2 קלפים.`
      } else if (s.activeOperation && state.hasPlayedCards) {
        // Player countered or played operation — pass activeOperation to next player
        keepActiveOp = true
      }

      // LOLOS penalty check (use updated player state after potential penalty draws)
      const updatedPlayer = s.players[s.currentPlayerIndex]
      if (updatedPlayer.hand.length === 1 && !updatedPlayer.calledLolos) {
        s = drawFromPile(s, 1, s.currentPlayerIndex)
        s.message = `${updatedPlayer.name} שכח/ה לקרוא לולוס! שלף/ה קלף עונשין.`
      }

      const nextIndex = (s.currentPlayerIndex + 1) % s.players.length
      const players = s.players.map((p) => ({ ...p, calledLolos: false }))
      return {
        ...s,
        players,
        currentPlayerIndex: nextIndex,
        phase: 'turn-transition',
        dice: null,
        selectedCards: [],
        equation: '',
        targetNumber: null,
        validTargets: [],
        activeOperation: keepActiveOp ? s.activeOperation : null,
        identicalPlayCount: 0,
        hasPlayedCards: false,
        hasDrawnCard: false,
      }
    }

    case 'SET_MESSAGE': {
      return { ...state, message: action.message }
    }

    case 'RESET_GAME': {
      return initialState
    }

    default:
      return state
  }
}

export const GameContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<GameAction>
}>({
  state: initialState,
  dispatch: () => undefined,
})

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}
