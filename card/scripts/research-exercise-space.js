#!/usr/bin/env node
/**
 * מרחב תרגילים דו-מספרי (כמו research-beginner-difficulty-he.md), מורחב ל־max 10 ו־15.
 * פלט: JSON ל־docs/research/research-0-10-15-exercise-metrics.json
 *
 * הרצה: node scripts/research-exercise-space.js
 * מתוך תיקיית card/
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'research', 'research-0-10-15-exercise-metrics.json');

function entropyFromHist(hist) {
  const vals = Object.values(hist);
  const n = vals.reduce((s, c) => s + c, 0);
  let h = 0;
  for (const c of vals) {
    if (c <= 0) continue;
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

function uniqResCount(hist) {
  return Object.keys(hist).length;
}

function carryCount(max) {
  let c = 0;
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) if ((a % 10) + (b % 10) >= 10) c++;
  return c;
}

function borrowMaxMinCount(max) {
  let k = 0;
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) {
      const mu = Math.max(a, b);
      const su = Math.min(a, b);
      if ((mu % 10) < (su % 10)) k++;
    }
  return k;
}

function borrowAbCount(max) {
  let k = 0;
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) if ((a % 10) < (b % 10)) k++;
  return k;
}

/** ציון עומס משוקלל — כיול מול שורות A–H (רגרסיה לינארית על entropy, neg%, kashim%) */
function cognitiveScore(entropy, negPct, kashimPct) {
  const w0 = -86.0735;
  const w1 = 26.065;
  const w2 = -0.5626;
  const w3 = 0.7713;
  const raw = w0 + w1 * entropy + w2 * negPct + w3 * kashimPct;
  return Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
}

function analyzeMax(max) {
  const n = max + 1;
  const nPairs = n * n;
  const cc = carryCount(max);
  const bmm = borrowMaxMinCount(max);
  const bab = borrowAbCount(max);

  const pct = (x, d) => (d === 0 ? 0 : (100 * x) / d);

  // A: + בלבד
  const histA = {};
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) {
      const s = a + b;
      histA[s] = (histA[s] || 0) + 1;
    }
  const naorA = pct(cc, nPairs);
  const rowA = {
    id: 'A',
    label: `${max}: + בלבד`,
    states: nPairs,
    uniqRes: uniqResCount(histA),
    negPct: 0,
    naorPct: naorA,
    entropy: +entropyFromHist(histA).toFixed(3),
    kashimPct: 0,
    cognitive: cognitiveScore(entropyFromHist(histA), 0, 0),
  };

  // B: - בלבד, ללא תוצאות שליליות (מקס־מין)
  const histB = {};
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) {
      const s = Math.max(a, b) - Math.min(a, b);
      histB[s] = (histB[s] || 0) + 1;
    }
  const naorB = pct(bmm, nPairs);
  const rowB = {
    id: 'B',
    label: `${max}: - בלבד (ללא שליליים, מקס־מין)`,
    states: nPairs,
    uniqRes: uniqResCount(histB),
    negPct: 0,
    naorPct: naorB,
    entropy: +entropyFromHist(histB).toFixed(3),
    kashimPct: naorB,
    cognitive: cognitiveScore(entropyFromHist(histB), 0, naorB),
  };

  // C: +/- ללא שליליים (חיבור + מקס־מין)
  const histC = { ...histA };
  for (const k of Object.keys(histB)) histC[k] = (histC[k] || 0) + histB[k];
  const statesC = 2 * nPairs;
  const naorC = pct(cc + bmm, statesC);
  const kashimC = pct(bmm, statesC);
  const entC = entropyFromHist(histC);
  const rowC = {
    id: 'C',
    label: `${max}: +/- ללא שליליים`,
    states: statesC,
    uniqRes: uniqResCount(histC),
    negPct: 0,
    naorPct: +naorC.toFixed(2),
    entropy: +entC.toFixed(3),
    kashimPct: +kashimC.toFixed(2),
    cognitive: cognitiveScore(entC, 0, kashimC),
  };

  // D: +/- עם שליליים (חיבור + a−b)
  const histD = { ...histA };
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) {
      const s = a - b;
      histD[s] = (histD[s] || 0) + 1;
    }
  let negHalf = 0;
  for (let a = 0; a <= max; a++)
    for (let b = 0; b <= max; b++) if (a - b < 0) negHalf++;
  const negPctD = pct(negHalf, statesC);
  const naorD = pct(cc + bab, statesC);
  const kashimD = pct(cc, nPairs);
  const entD = entropyFromHist(histD);
  const rowD = {
    id: 'D',
    label: `${max}: +/- עם שליליים`,
    states: statesC,
    uniqRes: uniqResCount(histD),
    negPct: +negPctD.toFixed(2),
    naorPct: +naorD.toFixed(2),
    entropy: +entD.toFixed(3),
    kashimPct: +kashimD.toFixed(2),
    cognitive: cognitiveScore(entD, negPctD, kashimD),
  };

  return { max, nPairs, rows: [rowA, rowB, rowC, rowD] };
}

const MAX_VALUES = [10, 12, 15];
const payload = {
  generatedAt: new Date().toISOString(),
  methodology: {
    naor:
      'חיבור: נשיאה כאשר (a%10)+(b%10)≥10. חיסור מקס־מין: השאלה כאשר (max%10)<(min%10). דו־שלבי עם שליליים: מחצית שנייה — (a%10)<(b%10).',
    kashim:
      'A: 0. B: כמו נשיאה/השאלה. C: מונה מקס־מין / (2n²). D: מונה נשיאה בחיבור / n² (כמו שורת D במחקר 0–12).',
    score:
      'ציון עומס: כיול לינארי מול A–H: -86.07 + 26.065×entropy - 0.5626×neg% + 0.7713×kashim%, חתוך ל־0–100.',
  },
  productNote:
    'במוצר: מצב קל 0–12, קוביות 1–6. כאן ניתוח לפי בקשת המחקר: קלפים 0–10 / 0–15.',
  byMax: {},
};

for (const max of MAX_VALUES) {
  payload.byMax[String(max)] = analyzeMax(max);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
console.log('Wrote', OUT);
