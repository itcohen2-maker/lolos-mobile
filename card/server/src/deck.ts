// ============================================================
// server/src/deck.ts — Deck creation, shuffle, deal
// ============================================================

import { randomBytes, randomInt } from 'node:crypto';
import type { Card, Fraction, Operation } from '../../shared/types';
import { wildDeckCount } from '../../shared/gameConstants';

/** Generate a cryptographically random card ID */
function makeId(): string { return `c-${randomBytes(6).toString('hex')}`; }

/** Fisher-Yates shuffle using cryptographic RNG */
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Generate a full Lolos deck (מיושר ל־index.tsx: מספרים, שברים אופציונליים, פעולות, סלינדה, פרא) */
const DEFAULT_FRAC_COUNTS: { frac: Fraction; count: number }[] = [
  { frac: '1/2', count: 6 }, { frac: '1/3', count: 4 },
  { frac: '1/4', count: 3 }, { frac: '1/5', count: 2 },
];

export function generateDeck(
  difficulty: 'easy' | 'full',
  includeFractions: boolean = true,
  enabledOperators?: Operation[],
  rangeMaxOverride?: 12 | 25,
  fractionKinds?: Fraction[] | null,
): Card[] {
  const cards: Card[] = [];
  const maxNumber = rangeMaxOverride ?? (difficulty === 'easy' ? 12 : 25);

  // Number cards: 4 copies of each (0 to maxNumber)
  for (let set = 0; set < 4; set++)
    for (let v = 0; v <= maxNumber; v++)
      cards.push({ id: makeId(), type: 'number', value: v });

  if (includeFractions) {
    const allow = fractionKinds && fractionKinds.length > 0 ? new Set(fractionKinds) : null;
    const fracs = allow
      ? DEFAULT_FRAC_COUNTS.filter((x) => allow.has(x.frac))
      : DEFAULT_FRAC_COUNTS;
    for (const { frac, count } of fracs)
      for (let i = 0; i < count; i++)
        cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  }

  // Operation cards: 4 of each
  const operations: Operation[] = enabledOperators && enabledOperators.length > 0 ? enabledOperators : ['+', '-', 'x', '÷'];
  for (const op of operations)
    for (let i = 0; i < (op === '÷' ? 3 : 4); i++)
      cards.push({ id: makeId(), type: 'operation', operation: op });

  // Joker cards: 4
  for (let i = 0; i < 4; i++)
    cards.push({ id: makeId(), type: 'joker' });

  const wilds = wildDeckCount(maxNumber, includeFractions);
  for (let i = 0; i < wilds; i++)
    cards.push({ id: makeId(), type: 'wild' });

  return cards;
}

/** Deal cards round-robin to players */
export function dealCards(deck: Card[], playerCount: number, cardsPerPlayer: number) {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let idx = 0;
  for (let c = 0; c < cardsPerPlayer; c++)
    for (let p = 0; p < playerCount; p++)
      if (idx < deck.length) hands[p].push(deck[idx++]);
  return { hands, remaining: deck.slice(idx) };
}
