#!/usr/bin/env node
/**
 * אינומרציה מלאה של 11³ הגרלות קוביות 0–10, יעדים לפי לוגיקת server/src/equations.ts
 * (evalThreeTerms + זוגות קוביות), אופרטורים +/− בלבד.
 *
 * הרצה: node scripts/research-dice-enumeration.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'research', 'research-0-10-dice-enumeration.json');

const ALL_OPS_PLUS_MINUS = ['+', '-'];

function applyOperation(a, op, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    default:
      return null;
  }
}

function isHighPrecedence(op) {
  return op === 'x' || op === '×' || op === '*' || op === '÷' || op === '/';
}

function evalThreeTerms(a, op1, b, op2, c) {
  if (isHighPrecedence(op2) && !isHighPrecedence(op1)) {
    const right = applyOperation(b, op2, c);
    if (right === null) return null;
    return applyOperation(a, op1, right);
  }
  const left = applyOperation(a, op1, b);
  if (left === null) return null;
  return applyOperation(left, op2, c);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

/** מקביל ל־generateValidTargets ב־equations.ts (ללא כפל/חילוק) */
function generateValidTargets(die1, die2, die3, allowNegativeTargets, maxTarget) {
  const allowedOps = ALL_OPS_PLUS_MINUS;
  const values = [die1, die2, die3];
  const perms = permutations(values);
  const seen = new Set();
  const results = [];

  for (const [a, b, c] of perms) {
    for (const op1 of allowedOps) {
      for (const op2 of allowedOps) {
        const r = evalThreeTerms(a, op1, b, op2, c);
        if (r !== null && (allowNegativeTargets || r >= 0) && Number.isInteger(r)) {
          const eq = `${a} ${op1} ${b} ${op2} ${c} = ${r}`;
          if (!seen.has(`${r}:${eq}`)) {
            seen.add(`${r}:${eq}`);
            results.push({ equation: eq, result: r });
          }
        }
      }
    }
  }

  const pairs = [
    [values[0], values[1]],
    [values[0], values[2]],
    [values[1], values[2]],
  ];
  for (const [a, b] of pairs) {
    for (const op of allowedOps) {
      const r1 = applyOperation(a, op, b);
      if (r1 !== null && (allowNegativeTargets || r1 >= 0) && Number.isInteger(r1)) {
        const eq1 = `${a} ${op} ${b} = ${r1}`;
        if (!seen.has(`${r1}:${eq1}`)) {
          seen.add(`${r1}:${eq1}`);
          results.push({ equation: eq1, result: r1 });
        }
      }
      const r2 = applyOperation(b, op, a);
      if (r2 !== null && (allowNegativeTargets || r2 >= 0) && Number.isInteger(r2)) {
        const eq2 = `${b} ${op} ${a} = ${r2}`;
        if (!seen.has(`${r2}:${eq2}`)) {
          seen.add(`${r2}:${eq2}`);
          results.push({ equation: eq2, result: r2 });
        }
      }
    }
  }

  const byResult = new Map();
  for (const opt of results) {
    if ((allowNegativeTargets || opt.result >= 0) && opt.result <= maxTarget && !byResult.has(opt.result)) {
      byResult.set(opt.result, opt);
    }
  }
  return Array.from(byResult.values()).sort((a, b) => a.result - b.result);
}

function runEnumeration(maxTarget, allowNegativeTargets) {
  const sizes = [];
  let sumSize = 0;
  let empty = 0;
  const histSize = {};

  for (let d1 = 0; d1 <= 10; d1++) {
    for (let d2 = 0; d2 <= 10; d2++) {
      for (let d3 = 0; d3 <= 10; d3++) {
        const opts = generateValidTargets(d1, d2, d3, allowNegativeTargets, maxTarget);
        const n = opts.length;
        sizes.push(n);
        sumSize += n;
        if (n === 0) empty++;
        histSize[n] = (histSize[n] || 0) + 1;
      }
    }
  }

  const total = 11 * 11 * 11;
  return {
    maxTarget,
    allowNegativeTargets,
    totalRolls: total,
    meanTargetCount: sumSize / total,
    minTargets: Math.min(...sizes),
    maxTargets: Math.max(...sizes),
    rollsWithZeroTargets: empty,
    pctRollsWithZeroTargets: (100 * empty) / total,
    targetCountHistogram: histSize,
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  note: 'קוביות 0–10, שלוש קוביות, פעולות +/− בלבד, סינון יעדים כמו equations.ts (תוצאה שלמה, בטווח maxTarget).',
  scenarios: [
    runEnumeration(10, false),
    runEnumeration(15, false),
    runEnumeration(10, true),
    runEnumeration(15, true),
  ],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
console.log('Wrote', OUT);
for (const s of payload.scenarios) {
  console.log(
    `maxTarget=${s.maxTarget} allowNeg=${s.allowNegativeTargets} mean|targets|=${s.meanTargetCount.toFixed(2)} zero%=${s.pctRollsWithZeroTargets.toFixed(3)}`,
  );
}
