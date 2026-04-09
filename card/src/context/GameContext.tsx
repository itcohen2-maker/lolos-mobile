import React, { createContext, useCallback, useMemo, useReducer, ReactNode } from 'react'
import { useLocaleOptional } from '../i18n/LocaleContext'
import { t as translateStatic, type MsgParams } from '../../shared/i18n'
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

function checkWin(state: GameState, tf: (key: string, params?: MsgParams) => string): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (currentPlayer.hand.length <= 2) {
    return { ...state, phase: 'game-over', winner: currentPlayer }
  }
  if (currentPlayer.hand.length === 3) {
    return {
      ...state,
      message: tf('legacy.threeCardsWarn', { name: currentPlayer.name }),
    }
  }
  return state
}

function gameReducer(
  state: GameState,
  action: GameAction,
  tf: (key: string, params?: MsgParams) => string,
): GameState {
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
            message: tf('legacy.opChallengeDefend', { op }),
          }
        } else {
          let s = drawFromPile(state, 2, state.currentPlayerIndex)
          return {
            ...s,
            phase: 'roll-dice',
            activeOperation: null,
            message: tf('legacy.opChallengePenalty', { op }),
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
        s.message = tf('toast.tripleDice', { n: String(dice.die1) })
        newState = s
      }

      const validTargets = generateValidTargets(dice)
      return {
        ...newState,
        validTargets,
        phase: 'select-cards',
        message: newState.message || (validTargets.length === 0
          ? tf('legacy.diceNoValidTargets')
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
        return { ...state, message: tf('legacy.playedThisTurn') }
      }
      if (state.selectedCards.length === 0) {
        return { ...state, message: tf('legacy.pickOneCard') }
      }
      const numberCards = state.selectedCards.filter((c) => c.type === 'number')
      if (numberCards.length !== state.selectedCards.length) {
        return { ...state, message: tf('legacy.numbersOnlyPlay') }
      }
      const cardSum = numberCards.reduce((s, c) => s + (c.value ?? 0), 0)
      const matchedTarget = state.validTargets.find((t) => t.result === cardSum)
      if (!matchedTarget) {
        const validNums = state.validTargets.map((t) => t.result).join(', ')
        return {
          ...state,
          message: tf('legacy.sumNoMatch', {
            sum: String(cardSum),
            valid: validNums || tf('legacy.noneValid'),
          }),
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
        message: tf('legacy.cardsPlayedEndTurn'),
      }

      newState = checkWin(newState, tf)
      if (newState.phase === 'game-over') return newState

      return { ...newState, phase: 'select-cards' }
    }

    case 'CONFIRM_EQUATION': {
      if (state.hasPlayedCards) {
        return { ...state, message: tf('legacy.playedThisTurn') }
      }
      if (state.selectedCards.length === 0) {
        return { ...state, message: tf('legacy.pickOneCard') }
      }
      const eqNumberCards = state.selectedCards.filter((c) => c.type === 'number')
      if (eqNumberCards.length !== state.selectedCards.length) {
        return { ...state, message: tf('legacy.numbersOnlyPlay') }
      }
      const eqCardSum = eqNumberCards.reduce((s, c) => s + (c.value ?? 0), 0)

      // Strict validation: equation result must match card sum AND be a valid target
      if (action.equationResult !== eqCardSum) {
        return { ...state, message: tf('legacy.equationWrong') }
      }
      const eqMatchedTarget = state.validTargets.find((t) => t.result === action.equationResult)
      if (!eqMatchedTarget) {
        return { ...state, message: tf('legacy.equationWrong') }
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
        message: tf('legacy.cardsPlayedEndTurn'),
      }

      eqNewState = checkWin(eqNewState, tf)
      if (eqNewState.phase === 'game-over') return eqNewState

      return { ...eqNewState, phase: 'select-cards' }
    }

    case 'PLAY_IDENTICAL': {
      if (state.hasPlayedCards) {
        return { ...state, message: tf('legacy.playedThisTurn') }
      }
      const topDiscard = state.discardPile[state.discardPile.length - 1]
      if (!validateIdenticalPlay(action.card, topDiscard)) {
        return { ...state, message: tf('legacy.cardNotMatchingTop') }
      }
      if (state.identicalPlayCount >= 2) {
        return { ...state, message: tf('legacy.identicalMaxTwo') }
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
        message: tf('legacy.identicalPlayed'),
      }

      newState = checkWin(newState, tf)
      if (newState.phase === 'game-over') return newState

      return newState
    }

    case 'PLAY_OPERATION': {
      if (state.hasPlayedCards) {
        return { ...state, message: tf('legacy.playedThisTurn') }
      }
      const currentPlayer = state.players[state.currentPlayerIndex]
      if (action.card.type !== 'operation') {
        return { ...state, message: tf('legacy.notOperationCard') }
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
        message: tf('legacy.operationPlayed', { op: action.card.operation! }),
      }

      newState = checkWin(newState, tf)
      return newState
    }

    case 'PLAY_FRACTION': {
      if (state.hasPlayedCards) {
        return { ...state, message: tf('legacy.playedThisTurn') }
      }
      const topDiscard = state.discardPile[state.discardPile.length - 1]
      if (!validateFractionPlay(action.card, topDiscard)) {
        return { ...state, message: tf('fraction.cannotPlayOnTop') }
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
        message: tf('legacy.fractionPlayedMath', {
          frac: action.card.fraction!,
          top: String(topValue),
          denom: String(denom),
          result: String(newValue),
        }),
      }

      newState = checkWin(newState, tf)
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
        message: tf('legacy.jokerPlayedAs', { op: action.chosenOperation }),
      }

      newState = checkWin(newState, tf)
      return newState
    }

    case 'DRAW_CARD': {
      if (state.hasPlayedCards) {
        return { ...state, message: tf('legacy.endTurnAfterPlay') }
      }
      let s = reshuffleDiscard(state)
      if (s.drawPile.length === 0) {
        return { ...s, hasDrawnCard: true, message: tf('legacy.noCardsToDraw') }
      }
      s = drawFromPile(s, 1, s.currentPlayerIndex)
      return {
        ...s,
        hasDrawnCard: true,
        message: tf('legacy.drewCardCount', { n: s.players[s.currentPlayerIndex].hand.length }),
      }
    }

    case 'CALL_LOLOS': {
      return state
    }

    case 'END_TURN': {
      let s = { ...state }
      let keepActiveOp = false

      // Operation penalty: only if player didn't counter (didn't play cards this turn)
      if (s.activeOperation && !state.hasPlayedCards) {
        s = drawFromPile(s, 2, s.currentPlayerIndex)
        s.message = tf('legacy.opPenaltyEndTurn', {
          name: state.players[state.currentPlayerIndex].name,
          op: state.activeOperation!,
        })
      } else if (s.activeOperation && state.hasPlayedCards) {
        // Player countered or played operation — pass activeOperation to next player
        keepActiveOp = true
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
  const loc = useLocaleOptional()
  const tf = useMemo(
    () => loc?.t ?? ((key: string, params?: MsgParams) => translateStatic('he', key, params)),
    [loc?.t],
  )
  const reducer = useCallback((s: GameState, a: GameAction) => gameReducer(s, a, tf), [tf])
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}
