import { Fraction, Operation } from '../types/game'

export function applyOperation(a: number, op: Operation, b: number): number | null {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case 'x': return a * b
    case '÷': return b !== 0 && a % b === 0 ? a / b : null
    default: return null
  }
}

export function opSymbol(op: Operation): string {
  return op
}

export function fractionToDecimal(f: Fraction): number {
  switch (f) {
    case '1/2': return 0.5
    case '1/3': return 1 / 3
    case '1/4': return 0.25
    case '1/5': return 0.2
  }
}

export function fractionDenominator(f: Fraction): number {
  switch (f) {
    case '1/2': return 2
    case '1/3': return 3
    case '1/4': return 4
    case '1/5': return 5
  }
}

export function isDivisibleByFraction(value: number, f: Fraction): boolean {
  const denom = fractionDenominator(f)
  return value % denom === 0 && value > 0
}

export function applyFraction(value: number, f: Fraction): number {
  return value / fractionDenominator(f)
}

export function parallelOperation(op: Operation): Operation {
  switch (op) {
    case '+': return '-'
    case '-': return '+'
    case 'x': return '÷'
    case '÷': return 'x'
  }
}
