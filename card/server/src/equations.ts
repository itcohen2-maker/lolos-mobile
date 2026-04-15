// ============================================================
// server/src/equations.ts — Equation & validation logic
// ============================================================

import type { Card, DiceResult, EquationOption, Fraction, Operation } from '../../shared/types';

/** Platform-safe replacement for node:crypto randomInt (works in RN + Node). */
function randomInt(min: number, maxExclusive: number): number {
  return min + Math.floor(Math.random() * (maxExclusive - min));
}

// ── Arithmetic ──

export function applyOperation(a: number, op: Operation | string, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function isHighPrecedence(op: string): boolean {
  return op === 'x' || op === '×' || op === '*' || op === '÷' || op === '/';
}

/** Evaluate a op1 b op2 c with standard order of operations (× ÷ before + −) */
export function evalThreeTerms(a: number, op1: string, b: number, op2: string, c: number): number | null {
  if (isHighPrecedence(op2) && !isHighPrecedence(op1)) {
    const right = applyOperation(b, op2, c);
    if (right === null) return null;
    return applyOperation(a, op1, right);
  }
  const left = applyOperation(a, op1, b);
  if (left === null) return null;
  return applyOperation(left, op2, c);
}

export function fractionDenominator(f: Fraction): number {
  switch (f) {
    case '1/2': return 2;
    case '1/3': return 3;
    case '1/4': return 4;
    case '1/5': return 5;
  }
}

export function isDivisibleByFraction(value: number, f: Fraction): boolean {
  const d = fractionDenominator(f);
  return value % d === 0 && value > 0;
}

// ── Equation result calculation (3 dice slots + 2 operators) ──

export function getCurrentResult(
  s1: number | null, op1: string, s2: number | null, op2: string, s3: number | null,
): number | null {
  try {
    if (s1 === null || s2 === null) return null;
    if (s3 !== null) {
      const result = evalThreeTerms(s1, op1, s2, op2, s3);
      if (result === null || !Number.isFinite(result)) return null;
      return result;
    }
    const intermediate = applyOperation(s1, op1, s2);
    if (intermediate === null || !Number.isFinite(intermediate)) return null;
    return intermediate;
  } catch {
    return null;
  }
}

// ── Dice ──

export function rollDice(): DiceResult {
  return {
    die1: randomInt(1, 7),
    die2: randomInt(1, 7),
    die3: randomInt(1, 7),
  };
}

export function isTriple(dice: DiceResult): boolean {
  return dice.die1 === dice.die2 && dice.die2 === dice.die3;
}

// ── Generate all valid targets from 3 dice ──

const ALL_OPS: Operation[] = ['+', '-', 'x', '÷'];

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

export function generateValidTargets(
  dice: DiceResult,
  enabledOperators?: Operation[],
  allowNegativeTargets: boolean = false,
  maxTarget: number = 25,
): EquationOption[] {
  const allowedOps = enabledOperators && enabledOperators.length > 0 ? enabledOperators : ALL_OPS;
  const values = [dice.die1, dice.die2, dice.die3];
  const perms = permutations(values);
  const seen = new Set<string>();
  const results: EquationOption[] = [];

  // 3-dice combinations (standard order of operations)
  for (const [a, b, c] of perms) {
    for (const op1 of allowedOps) {
      for (const op2 of allowedOps) {
        const r = evalThreeTerms(a, op1, b, op2, c);
        if (r !== null && (allowNegativeTargets || r >= 0) && Number.isInteger(r)) {
          const eq = `${a} ${op1} ${b} ${op2} ${c} = ${r}`;
          if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push({ equation: eq, result: r }); }
        }
      }
    }
  }

  // 2-dice combinations
  const pairs: [number, number][] = [
    [values[0], values[1]], [values[0], values[2]], [values[1], values[2]],
  ];
  for (const [a, b] of pairs) {
    for (const op of allowedOps) {
      const r1 = applyOperation(a, op, b);
      if (r1 !== null && (allowNegativeTargets || r1 >= 0) && Number.isInteger(r1)) {
        const eq1 = `${a} ${op} ${b} = ${r1}`;
        if (!seen.has(`${r1}:${eq1}`)) { seen.add(`${r1}:${eq1}`); results.push({ equation: eq1, result: r1 }); }
      }
      const r2 = applyOperation(b, op, a);
      if (r2 !== null && (allowNegativeTargets || r2 >= 0) && Number.isInteger(r2)) {
        const eq2 = `${b} ${op} ${a} = ${r2}`;
        if (!seen.has(`${r2}:${eq2}`)) { seen.add(`${r2}:${eq2}`); results.push({ equation: eq2, result: r2 }); }
      }
    }
  }

  // Deduplicate by result, keep first equation per result
  const byResult = new Map<number, EquationOption>();
  for (const opt of results)
    if ((allowNegativeTargets || opt.result >= 0) && opt.result <= maxTarget && !byResult.has(opt.result)) {
      byResult.set(opt.result, opt);
    }
  return Array.from(byResult.values()).sort((a, b) => a.result - b.result);
}

// ── Validation functions ──

/** ערך מספרי אפקטיבי: מספר → value, פרא על הערימה → resolvedValue */
export function getEffectiveNumber(card: Card | undefined): number | null {
  if (!card) return null;
  if (card.type === 'number') return card.value ?? null;
  if (card.type === 'wild') return card.resolvedValue ?? null;
  return null;
}

export function validateIdenticalPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!topDiscard) return false;
  if (card.type === 'wild') return topDiscard.type === 'number' || topDiscard.type === 'wild';
  if (card.type !== topDiscard.type) return false;
  switch (card.type) {
    case 'number': return card.value === topDiscard.value;
    case 'fraction': return card.fraction === topDiscard.fraction;
    case 'operation': return card.operation === topDiscard.operation;
    case 'joker': return topDiscard.type === 'joker';
    default: return false;
  }
}

export function validateFractionPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!card.fraction || !topDiscard) return false;
  if (topDiscard.type !== 'number' && topDiscard.type !== 'wild') return false;
  const effective = getEffectiveNumber(topDiscard);
  if (effective === null) return false;
  return isDivisibleByFraction(effective, card.fraction as Fraction);
}

function getStagedPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getStagedPermutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

export function validateStagedCards(
  numberCards: Card[],
  opCard: Card | null,
  target: number,
  maxWild: number = 25,
): boolean {
  const cap = Math.max(0, Math.min(25, maxWild));
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount > 1) return false;
  if (wildCount === 1) {
    if (!opCard) {
      const sum = values.reduce((s, v) => s + v, 0);
      const wildVal = target - sum;
      return wildVal >= 0 && wildVal <= cap && Number.isInteger(wildVal);
    }
    const op = opCard.operation!;
    for (let wildVal = 0; wildVal <= cap; wildVal++) {
      const allVals = [...values, wildVal];
      const perms = getStagedPermutations(allVals);
      for (const perm of perms) {
        for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
          let result: number | null = perm[0];
          for (let i = 1; i < perm.length; i++) {
            const useOp = i - 1 === gapPos ? op : '+';
            result = applyOperation(result!, useOp, perm[i]);
            if (result === null) break;
          }
          if (result !== null && result === target) return true;
        }
      }
    }
    return false;
  }
  if (values.length === 0) return false;
  if (!opCard) return values.reduce((s, v) => s + v, 0) === target;
  const op = opCard.operation!;
  const perms = getStagedPermutations(values);
  for (const perm of perms) {
    for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
      let result: number | null = perm[0];
      for (let i = 1; i < perm.length; i++) {
        const useOp = i - 1 === gapPos ? op : '+';
        result = applyOperation(result!, useOp, perm[i]);
        if (result === null) break;
      }
      if (result !== null && result === target) return true;
    }
  }
  return false;
}

export function computeWildValueInStaged(
  numberCards: Card[],
  opCard: Card | null,
  target: number,
  maxWild: number = 25,
): number | null {
  const cap = Math.max(0, Math.min(25, maxWild));
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount !== 1) return null;
  if (!opCard) {
    const wildVal = target - values.reduce((s, v) => s + v, 0);
    return wildVal >= 0 && wildVal <= cap && Number.isInteger(wildVal) ? wildVal : null;
  }
  const op = opCard.operation!;
  for (let wildVal = 0; wildVal <= cap; wildVal++) {
    const allVals = [...values, wildVal];
    const perms = getStagedPermutations(allVals);
    for (const perm of perms) {
      for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
        let result: number | null = perm[0];
        for (let i = 1; i < perm.length; i++) {
          const useOp = i - 1 === gapPos ? op : '+';
          result = applyOperation(result!, useOp, perm[i]);
          if (result === null) break;
        }
        if (result !== null && result === target) return wildVal;
      }
    }
  }
  return null;
}

export function resolveDiscardNumberCardFromStaged(
  stagedCards: Card[],
  equationResult: number,
  maxWild: number = 25,
): Card {
  const stagedNumbers = stagedCards.filter(c => c.type === 'number' || c.type === 'wild');
  const stagedOpCard = stagedCards.find(c => c.type === 'operation') ?? null;
  const wildVal = stagedNumbers.some(c => c.type === 'wild')
    ? computeWildValueInStaged(stagedNumbers, stagedOpCard, equationResult, maxWild)
    : null;

  for (let i = stagedCards.length - 1; i >= 0; i--) {
    const c = stagedCards[i];
    if (c.type === 'number') return c;
    if (c.type === 'wild') return wildVal !== null ? { ...c, resolvedValue: wildVal } : c;
  }

  const fallback = stagedNumbers[stagedNumbers.length - 1];
  if (fallback?.type === 'wild') {
    return wildVal !== null ? { ...fallback, resolvedValue: wildVal } : fallback;
  }
  return fallback as Card;
}

export function computeStagedResult(staged: Card[]): number | null {
  const parsed: ({ type: 'num'; value: number } | { type: 'op'; op: Operation })[] = [];
  for (const c of staged) {
    if (c.type === 'number') parsed.push({ type: 'num', value: c.value ?? 0 });
    else if (c.type === 'operation') parsed.push({ type: 'op', op: c.operation! });
  }
  if (parsed.length === 0) return null;
  let result: number | null = null;
  let pendingOp: Operation = '+';
  for (const item of parsed) {
    if (item.type === 'num') {
      if (result === null) { result = item.value; }
      else { result = applyOperation(result, pendingOp, item.value); pendingOp = '+'; }
      if (result === null) return null;
    } else {
      pendingOp = item.op;
    }
  }
  return result;
}
