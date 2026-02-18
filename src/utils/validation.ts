import { Card, Fraction } from '../types/game'
import { isDivisibleByFraction } from './arithmetic'

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
