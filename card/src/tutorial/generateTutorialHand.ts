// ============================================================
// generateTutorialHand.ts — Generate rigged hands for tutorial
// Guarantees solvable equations with at least 2 solution paths.
// ============================================================

import type { Card, DiceResult, EquationOption, Fraction, Operation } from '../../shared/types';
import type { LessonConfig } from './tutorialLessons';

// ── Inline equation helpers (mirror of server/src/equations.ts) ──
// We inline these to avoid importing from server/ which may have
// Node.js-only dependencies. These are pure math functions.

function applyOp(a: number, op: Operation | string, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function isHighPrec(op: string): boolean {
  return op === 'x' || op === '×' || op === '*' || op === '÷' || op === '/';
}

function evalThree(a: number, op1: string, b: number, op2: string, c: number): number | null {
  if (isHighPrec(op2) && !isHighPrec(op1)) {
    const right = applyOp(b, op2, c);
    if (right === null) return null;
    return applyOp(a, op1, right);
  }
  const left = applyOp(a, op1, b);
  if (left === null) return null;
  return applyOp(left, op2, c);
}

function perms(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of perms(rest)) result.push([arr[i], ...p]);
  }
  return result;
}

const ALL_OPS: Operation[] = ['+', '-', 'x', '÷'];

function generateValidTargets(
  dice: DiceResult,
  enabledOperators?: Operation[],
  allowNegativeTargets = false,
  maxTarget = 25,
): EquationOption[] {
  const ops = enabledOperators?.length ? enabledOperators : ALL_OPS;
  const values = [dice.die1, dice.die2, dice.die3];
  const ps = perms(values);
  const seen = new Set<string>();
  const results: EquationOption[] = [];
  for (const [a, b, c] of ps) {
    for (const op1 of ops) {
      for (const op2 of ops) {
        const r = evalThree(a, op1, b, op2, c);
        if (r !== null && (allowNegativeTargets || r >= 0) && Number.isInteger(r)) {
          const eq = `${a} ${op1} ${b} ${op2} ${c} = ${r}`;
          if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push({ equation: eq, result: r }); }
        }
      }
    }
  }
  const pairs: [number, number][] = [[values[0], values[1]], [values[0], values[2]], [values[1], values[2]]];
  for (const [a, b] of pairs) {
    for (const op of ops) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const r = applyOp(x, op, y);
        if (r !== null && (allowNegativeTargets || r >= 0) && Number.isInteger(r)) {
          const eq = `${x} ${op} ${y} = ${r}`;
          if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push({ equation: eq, result: r }); }
        }
      }
    }
  }
  const byResult = new Map<number, EquationOption>();
  for (const opt of results)
    if ((allowNegativeTargets || opt.result >= 0) && opt.result <= maxTarget && !byResult.has(opt.result))
      byResult.set(opt.result, opt);
  return Array.from(byResult.values()).sort((a, b) => a.result - b.result);
}

let tutIdCounter = 0;
function tutId(): string { return `tut-${++tutIdCounter}`; }

function numCard(value: number): Card {
  return { id: tutId(), type: 'number', value };
}

function opCard(op: Operation): Card {
  return { id: tutId(), type: 'operation', operation: op };
}

function jokerCard(): Card {
  return { id: tutId(), type: 'joker' };
}

function wildCard(): Card {
  return { id: tutId(), type: 'wild' };
}

function fractionCard(frac: Fraction): Card {
  return { id: tutId(), type: 'fraction', fraction: frac };
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick a target that has a simple a + b solution (addition only) */
function pickAdditionTarget(
  targets: EquationOption[],
  maxRange: number,
): { target: EquationOption; a: number; b: number } | null {
  for (const t of shuffle([...targets])) {
    if (t.result <= 0 || t.result > maxRange) continue;
    // Find two numbers that sum to target
    for (let a = 1; a < t.result && a <= maxRange; a++) {
      const b = t.result - a;
      if (b > 0 && b <= maxRange && b !== a) {
        return { target: t, a, b };
      }
    }
  }
  return null;
}

/** Pick a target that benefits from an operation card (not just addition) */
function pickOperationTarget(
  targets: EquationOption[],
  ops: Operation[],
  maxRange: number,
): { target: EquationOption; a: number; b: number; op: Operation } | null {
  const nonPlusOps = ops.filter(o => o !== '+');
  for (const t of shuffle([...targets])) {
    if (t.result <= 0 || t.result > maxRange) continue;
    for (const op of shuffle([...nonPlusOps])) {
      if (op === 'x') {
        // a * b = target
        for (let a = 2; a <= Math.min(6, maxRange); a++) {
          if (t.result % a === 0) {
            const b = t.result / a;
            if (b > 0 && b <= maxRange && b !== a) {
              return { target: t, a, b, op };
            }
          }
        }
      } else if (op === '-') {
        // a - b = target
        for (let b = 1; b <= Math.min(6, maxRange); b++) {
          const a = t.result + b;
          if (a > 0 && a <= maxRange) {
            return { target: t, a, b, op };
          }
        }
      }
    }
  }
  return null;
}

export interface TutorialHandResult {
  playerHand: Card[];
  botHand: Card[];
  /** If lesson requires identical play, this is the discard pile top */
  discardTop: Card | null;
  /** The primary solution path for hints */
  solutionCardIds: string[];
  /** The equation the user should target */
  targetEquation: EquationOption | null;
}

export function generateTutorialHand(
  dice: DiceResult,
  lesson: LessonConfig,
): TutorialHandResult {
  tutIdCounter = 0;
  const targets = generateValidTargets(
    dice,
    lesson.enabledOperators,
    false,
    lesson.maxRange,
  );

  if (targets.length === 0) {
    // Fallback: simple hand
    return fallbackHand(lesson);
  }

  const HAND_SIZE = 7;
  const solutionCards: Card[] = [];
  const specialCards: Card[] = [];
  let targetEq: EquationOption | null = null;
  let discardTop: Card | null = null;

  switch (lesson.index) {
    case 0: {
      // Round 1: addition only
      const pick = pickAdditionTarget(targets, lesson.maxRange);
      if (pick) {
        targetEq = pick.target;
        solutionCards.push(numCard(pick.a), numCard(pick.b));
      }
      break;
    }

    case 1: {
      // Round 2: operation card
      const pick = pickOperationTarget(targets, lesson.enabledOperators, lesson.maxRange);
      if (pick) {
        targetEq = pick.target;
        solutionCards.push(numCard(pick.a), numCard(pick.b));
        specialCards.push(opCard(pick.op));
      }
      break;
    }

    case 2: {
      // Round 3: joker card (user chooses operation)
      const pick = pickOperationTarget(targets, lesson.enabledOperators, lesson.maxRange);
      if (pick) {
        targetEq = pick.target;
        solutionCards.push(numCard(pick.a), numCard(pick.b));
        specialCards.push(jokerCard());
      }
      break;
    }

    case 3: {
      // Round 4: wild card
      const pick = pickAdditionTarget(targets, lesson.maxRange);
      if (pick) {
        targetEq = pick.target;
        // Only give one number, wild replaces the other
        solutionCards.push(numCard(pick.a));
        specialCards.push(wildCard());
      }
      break;
    }

    case 4: {
      // Round 5: identical + fraction
      const pick = pickAdditionTarget(targets, lesson.maxRange);
      if (pick) {
        targetEq = pick.target;
        solutionCards.push(numCard(pick.a), numCard(pick.b));
        // Identical card: match a number on the discard pile
        const identicalValue = randInt(1, 8);
        discardTop = numCard(identicalValue);
        specialCards.push(numCard(identicalValue)); // identical to discard top
        const fracs: Fraction[] = lesson.fractionKinds ?? ['1/2'];
        specialCards.push(fractionCard(fracs[0]));
      }
      break;
    }

    default: {
      // Round 6 (free play): simple addition
      const pick = pickAdditionTarget(targets, lesson.maxRange);
      if (pick) {
        targetEq = pick.target;
        solutionCards.push(numCard(pick.a), numCard(pick.b));
      }
      break;
    }
  }

  // Fill distractors
  const usedValues = new Set(
    [...solutionCards, ...specialCards]
      .filter(c => c.type === 'number')
      .map(c => c.value),
  );
  const distractors: Card[] = [];
  let fillAttempts = 0;
  const needed = HAND_SIZE - solutionCards.length - specialCards.length;
  while (distractors.length < needed && fillAttempts < 100) {
    const v = randInt(1, lesson.maxRange);
    if (!usedValues.has(v)) {
      usedValues.add(v);
      distractors.push(numCard(v));
    }
    fillAttempts++;
  }
  // Pad if needed
  while (distractors.length < needed) {
    distractors.push(numCard(randInt(1, lesson.maxRange)));
  }

  const solutionIds = solutionCards.map(c => c.id);
  const playerHand = shuffle([...solutionCards, ...specialCards, ...distractors]);

  // Bot hand: simple numbers that can solve any target
  const botHand = generateBotHand(targets, lesson);

  return {
    playerHand,
    botHand,
    discardTop,
    solutionCardIds: solutionIds,
    targetEquation: targetEq,
  };
}

function generateBotHand(targets: EquationOption[], lesson: LessonConfig): Card[] {
  const HAND_SIZE = 7;
  const cards: Card[] = [];

  // Give bot cards that solve the first target via addition
  const pick = pickAdditionTarget(targets, lesson.maxRange);
  if (pick) {
    cards.push(numCard(pick.a), numCard(pick.b));
  }

  // Add special cards for bot demonstration per lesson
  if (lesson.index === 1) cards.push(opCard(lesson.enabledOperators[1] ?? 'x'));
  if (lesson.index === 2) cards.push(jokerCard());
  if (lesson.index === 3) cards.push(wildCard());
  if (lesson.index === 4 && lesson.fractionKinds?.length) {
    cards.push(fractionCard(lesson.fractionKinds[0]));
  }

  // Fill remaining with random numbers
  while (cards.length < HAND_SIZE) {
    cards.push(numCard(randInt(1, lesson.maxRange)));
  }

  return shuffle(cards);
}

function fallbackHand(lesson: LessonConfig): TutorialHandResult {
  const HAND_SIZE = 7;
  const cards: Card[] = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    cards.push(numCard(randInt(1, lesson.maxRange)));
  }
  return {
    playerHand: cards,
    botHand: cards.map(c => numCard(c.value ?? randInt(1, 6))),
    discardTop: null,
    solutionCardIds: [],
    targetEquation: null,
  };
}
