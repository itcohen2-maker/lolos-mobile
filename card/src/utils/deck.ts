import { Card, Fraction, Operation } from '../types/game'

let cardIdCounter = 0

function makeId(): string {
  return `card-${++cardIdCounter}`
}

export function resetCardIdCounter() {
  cardIdCounter = 0
}

export function generateDeck(difficulty: 'easy' | 'full'): Card[] {
  resetCardIdCounter()
  const cards: Card[] = []
  const maxNumber = difficulty === 'easy' ? 12 : 25

  // 4 sets of number cards
  for (let set = 0; set < 4; set++) {
    for (let v = 0; v <= maxNumber; v++) {
      cards.push({ id: makeId(), type: 'number', value: v })
    }
  }

  // Fraction cards: 6x ½, 4x each of ⅓, ¼, ⅕
  const fractions: { frac: Fraction; count: number }[] = [
    { frac: '1/2', count: 6 },
    { frac: '1/3', count: 4 },
    { frac: '1/4', count: 4 },
    { frac: '1/5', count: 4 },
  ]
  for (const { frac, count } of fractions) {
    for (let i = 0; i < count; i++) {
      cards.push({ id: makeId(), type: 'fraction', fraction: frac })
    }
  }

  // Operation cards: 4 each of +, -, ×, ÷
  const operations: Operation[] = ['+', '-', 'x', '÷']
  for (const op of operations) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: makeId(), type: 'operation', operation: op })
    }
  }

  // Joker cards: 4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: makeId(), type: 'joker' })
  }

  return cards
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function dealCards(
  deck: Card[],
  playerCount: number,
  cardsPerPlayer: number
): { hands: Card[][]; remaining: Card[] } {
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  let idx = 0
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < playerCount; p++) {
      if (idx < deck.length) {
        hands[p].push(deck[idx++])
      }
    }
  }
  return { hands, remaining: deck.slice(idx) }
}
