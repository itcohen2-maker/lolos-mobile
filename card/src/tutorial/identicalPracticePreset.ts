import type { Card } from '../types/game'

export type IdenticalPracticePreset = {
  target: number
  fanCards: Card[]
}

export function buildIdenticalPracticePreset(target: number = 7): IdenticalPracticePreset {
  // Keep options focused on combinations (no single-card direct hit).
  const values = [0, 1, 2, 3, 4, 5, 6]
  const fanCards = values.map((value, index) => ({
    id: `identical-practice-${value}-${index}`,
    type: 'number' as const,
    value,
  }))

  return { target, fanCards }
}
