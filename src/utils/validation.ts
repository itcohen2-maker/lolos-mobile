import { Card, Fraction, Operation } from '../types/game'
import { isDivisibleByFraction, applyOperation } from './arithmetic'

export function sumOfNumberCards(cards: Card[]): number {
  return cards
    .filter((c) => c.type === 'number')
    .reduce((sum, c) => sum + (c.value ?? 0), 0)
}

export function validateNumberCardPlay(
  selectedCards: Card[],
  target: number
): boolean {
  const numberCards = selectedCards.filter((c) => c.type === 'number')
  if (numberCards.length === 0) return false
  return sumOfNumberCards(numberCards) === target
}

export function validateIdenticalPlay(
  card: Card,
  topDiscard: Card | undefined
): boolean {
  if (!topDiscard) return false
  if (card.type !== topDiscard.type) return false

  switch (card.type) {
    case 'number':
      return card.value === topDiscard.value
    case 'fraction':
      return card.fraction === topDiscard.fraction
    case 'operation':
      return card.operation === topDiscard.operation
    case 'joker':
      return topDiscard.type === 'joker'
    default:
      return false
  }
}

export function validateFractionPlay(
  card: Card,
  topDiscard: Card | undefined
): boolean {
  if (!card.fraction || !topDiscard) return false
  if (topDiscard.type !== 'number' || topDiscard.value === undefined) return false
  return isDivisibleByFraction(topDiscard.value, card.fraction as Fraction)
}

export function canPlayAnything(
  hand: Card[],
  topDiscard: Card | undefined,
  target: number | null,
  identicalPlayCount: number
): boolean {
  // Check identical plays
  if (identicalPlayCount < 2) {
    for (const card of hand) {
      if (validateIdenticalPlay(card, topDiscard)) return true
    }
  }

  // Check operation cards (always playable)
  if (hand.some((c) => c.type === 'operation')) return true

  // Check joker cards (always playable)
  if (hand.some((c) => c.type === 'joker')) return true

  // Check fraction cards
  for (const card of hand) {
    if (card.type === 'fraction' && validateFractionPlay(card, topDiscard)) {
      return true
    }
  }

  // Check number cards against target
  if (target !== null) {
    const numberCards = hand.filter((c) => c.type === 'number')
    if (canSumToTarget(numberCards, target)) return true
  }

  return false
}

function canSumToTarget(cards: Card[], target: number): boolean {
  const values = cards.map((c) => c.value ?? 0)
  // Check all subsets
  const n = values.length
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += values[i]
      }
    }
    if (sum === target) return true
  }
  return false
}

/**
 * Evaluate a dice equation built by the player.
 * diceSlots: array of 3 slots, each is a die value or null.
 * ops: array of 2 operation slots.
 * grouping: 'left' = (A op1 B) op2 C, 'right' = A op1 (B op2 C).
 * Returns { valid, result } — valid means at least 2 dice used and result is a non-negative integer.
 */
export function checkEquation(
  diceSlots: (number | null)[],
  ops: (Operation | null)[],
  grouping: 'left' | 'right'
): { valid: boolean; result: number | null } {
  // Count contiguous filled slots from the left
  let filledCount = 0
  for (let i = 0; i < diceSlots.length; i++) {
    if (diceSlots[i] !== null) filledCount++
    else break
  }

  if (filledCount < 2) return { valid: false, result: null }

  let result: number | null = null

  if (filledCount === 2) {
    if (ops[0] === null) return { valid: false, result: null }
    result = applyOperation(diceSlots[0]!, ops[0], diceSlots[1]!)
  } else if (filledCount === 3) {
    if (ops[0] === null || ops[1] === null) return { valid: false, result: null }
    if (grouping === 'left') {
      const ab = applyOperation(diceSlots[0]!, ops[0], diceSlots[1]!)
      if (ab !== null) result = applyOperation(ab, ops[1], diceSlots[2]!)
    } else {
      const bc = applyOperation(diceSlots[1]!, ops[1], diceSlots[2]!)
      if (bc !== null) result = applyOperation(diceSlots[0]!, ops[0], bc)
    }
  }

  if (result === null) return { valid: false, result: null }
  if (!Number.isInteger(result) || result < 0) return { valid: false, result }

  return { valid: true, result }
}
