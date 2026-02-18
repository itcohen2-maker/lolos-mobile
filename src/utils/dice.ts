import { DiceResult, EquationOption, Operation } from '../types/game'
import { applyOperation } from './arithmetic'

export function rollDice(): DiceResult {
  return {
    die1: Math.floor(Math.random() * 6) + 1,
    die2: Math.floor(Math.random() * 6) + 1,
    die3: Math.floor(Math.random() * 6) + 1,
  }
}

export function isTriple(dice: DiceResult): boolean {
  return dice.die1 === dice.die2 && dice.die2 === dice.die3
}

const ALL_OPS: Operation[] = ['+', '-', 'x', '÷']

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  const result: number[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm])
    }
  }
  return result
}

export function generateValidTargets(dice: DiceResult): EquationOption[] {
  const values = [dice.die1, dice.die2, dice.die3]
  const perms = permutations(values)
  const seen = new Set<string>()
  const results: EquationOption[] = []

  for (const [a, b, c] of perms) {
    for (const op1 of ALL_OPS) {
      for (const op2 of ALL_OPS) {
        // (a op1 b) op2 c
        const ab = applyOperation(a, op1, b)
        if (ab !== null) {
          const res1 = applyOperation(ab, op2, c)
          if (res1 !== null && res1 >= 0 && Number.isInteger(res1)) {
            const eq = `(${a} ${op1} ${b}) ${op2} ${c} = ${res1}`
            const key = `${res1}:${eq}`
            if (!seen.has(key)) {
              seen.add(key)
              results.push({ equation: eq, result: res1 })
            }
          }
        }

        // a op1 (b op2 c)
        const bc = applyOperation(b, op2, c)
        if (bc !== null) {
          const res2 = applyOperation(a, op1, bc)
          if (res2 !== null && res2 >= 0 && Number.isInteger(res2)) {
            const eq = `${a} ${op1} (${b} ${op2} ${c}) = ${res2}`
            const key = `${res2}:${eq}`
            if (!seen.has(key)) {
              seen.add(key)
              results.push({ equation: eq, result: res2 })
            }
          }
        }
      }
    }
  }

  // Deduplicate by result value, keeping one equation per result
  const byResult = new Map<number, EquationOption>()
  for (const opt of results) {
    if (!byResult.has(opt.result)) {
      byResult.set(opt.result, opt)
    }
  }

  return Array.from(byResult.values()).sort((a, b) => a.result - b.result)
}
