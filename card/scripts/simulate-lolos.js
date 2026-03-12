#!/usr/bin/env node
/**
 * לולוס — סימולציית מונטה קרלו (3 שחקנים, חפיסה מלאה עם שברים)
 * מחשב: P(סיום), ממוצע/חציון תורות, התפלגות.
 * הרצה: node card/scripts/simulate-lolos.js
 * פלט: קונסול + קובץ דיווח ב-card/docs/simulation-report-3players.md
 */

const fs = require('fs');
const path = require('path');

const CARDS_PER_PLAYER = 7;
const NUM_PLAYERS = 3;
const MAX_TURNS = parseInt(process.env.MAX_TURNS || '400', 10);
const NUM_GAMES = parseInt(process.argv[2] || process.env.NUM_GAMES || '5000', 10);
const DECK_MODE = 'full'; // 0-25
const INCLUDE_FRACTIONS = true;

// גרסה "15 קלפי שבר" (חוקים: 3 קלפים ל־1/3, 1/4, 1/5): [6,3,3,3]
const FRACTION_COUNTS_15 = [[6, '1/2'], [3, '1/3'], [3, '1/4'], [3, '1/5']];
// קלף פרא: נספר ככל מספר 0–25 — מגדיל סיכוי להניח קלף בתור
const WILD_COUNT = 4;

// --- Deck (same as game) ---
let cardId = 0;
function makeId() { return `c${++cardId}`; }

function generateDeck(opts = {}) {
  cardId = 0;
  const cards = [];
  const maxNumber = DECK_MODE === 'easy' ? 12 : 25;
  for (let set = 0; set < 4; set++)
    for (let v = 0; v <= maxNumber; v++)
      cards.push({ id: makeId(), type: 'number', value: v });
  if (INCLUDE_FRACTIONS) {
    const fracs = opts.fraction15 ? FRACTION_COUNTS_15 : [[6, '1/2'], [3, '1/3'], [3, '1/4'], [2, '1/5']];
    for (const [count, frac] of fracs)
      for (let i = 0; i < count; i++)
        cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  }
  const ops = ['+', '-', 'x', '÷'];
  for (const op of ops)
    for (let i = 0; i < 4; i++)
      cards.push({ id: makeId(), type: 'operation', operation: op });
  for (let i = 0; i < 4; i++)
    cards.push({ id: makeId(), type: 'joker' });
  if (opts.addWild)
    for (let i = 0; i < WILD_COUNT; i++)
      cards.push({ id: makeId(), type: 'wild' });
  return cards;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(deck, nPlayers, perPlayer) {
  const hands = Array.from({ length: nPlayers }, () => []);
  let idx = 0;
  for (let c = 0; c < perPlayer; c++)
    for (let p = 0; p < nPlayers; p++)
      if (idx < deck.length) hands[p].push(deck[idx++]);
  return { hands, remaining: deck.slice(idx) };
}

// --- Arithmetic (order of operations) ---
function applyOp(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function isHighPrecedence(op) {
  return op === 'x' || op === '*' || op === '×' || op === '÷' || op === '/';
}

function evalThreeTerms(a, op1, b, op2, c) {
  if (isHighPrecedence(op2) && !isHighPrecedence(op1)) {
    const right = applyOp(b, op2, c);
    if (right === null) return null;
    return applyOp(a, op1, right);
  }
  const left = applyOp(a, op1, b);
  if (left === null) return null;
  return applyOp(left, op2, c);
}

const ALL_OPS = ['+', '-', 'x', '÷'];

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) result.push([arr[i], ...p]);
  }
  return result;
}

function generateValidTargets(die1, die2, die3) {
  const values = [die1, die2, die3];
  const perms = permutations(values);
  const seen = new Set();
  const results = [];

  for (const [a, b, c] of perms) {
    for (const op1 of ALL_OPS) {
      for (const op2 of ALL_OPS) {
        const r = evalThreeTerms(a, op1, b, op2, c);
        if (r !== null && r >= 0 && Number.isInteger(r)) {
          const eq = `${a} ${op1} ${b} ${op2} ${c} = ${r}`;
          if (!seen.has(`${r}:${eq}`)) { seen.add(`${r}:${eq}`); results.push(r); }
        }
        const lr1 = applyOp(a, op1, b);
        if (lr1 !== null) {
          const lr = applyOp(lr1, op2, c);
          if (lr !== null && lr >= 0 && Number.isInteger(lr)) {
            const eq2 = `(${a}${op1}${b})${op2}${c}=${lr}`;
            if (!seen.has(`${lr}:${eq2}`)) { seen.add(`${lr}:${eq2}`); results.push(lr); }
          }
        }
      }
    }
  }
  const pairs = [[values[0], values[1]], [values[0], values[2]], [values[1], values[2]]];
  for (const [a, b] of pairs) {
    for (const op of ALL_OPS) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const r = applyOp(x, op, y);
        if (r !== null && r >= 0 && Number.isInteger(r) && r <= 25)
          results.push(r);
      }
    }
  }
  const uniq = [...new Set(results)].filter(r => r >= 0 && r <= 25);
  return uniq;
}

function identical(card, top) {
  if (!top || card.type !== top.type) return false;
  if (card.type === 'number') return card.value === top.value;
  if (card.type === 'fraction') return card.fraction === top.fraction;
  if (card.type === 'operation') return card.operation === top.operation;
  if (card.type === 'joker') return top.type === 'joker';
  return false;
}

// --- Reshuffle discard into draw when draw empty ---
function reshuffle(drawPile, discardPile) {
  if (drawPile.length > 0 || discardPile.length <= 1) return { drawPile, discardPile };
  const top = discardPile[discardPile.length - 1];
  const rest = discardPile.slice(0, -1);
  return { drawPile: shuffle(rest), discardPile: [top] };
}

// --- One game: returns { finished: boolean, turns: number, winnerIndex: number | null } ---
function runOneGame(opts = {}) {
  const deck = shuffle(generateDeck({ fraction15: true, addWild: !!opts.addWild }));
  const { hands, remaining } = deal(deck, NUM_PLAYERS, CARDS_PER_PLAYER);
  let drawPile = remaining;
  let discardPile = [];
  // First discard: first number from draw (like START_GAME)
  for (let i = 0; i < drawPile.length; i++) {
    if (drawPile[i].type === 'number') {
      discardPile = [drawPile[i]];
      drawPile = [...drawPile.slice(0, i), ...drawPile.slice(i + 1)];
      break;
    }
  }
  if (discardPile.length === 0) {
    discardPile = [drawPile[0]];
    drawPile = drawPile.slice(1);
  }

  const players = hands.map((hand, i) => ({ hand: [...hand], calledLolos: false }));
  let currentPlayer = 0;
  let turns = 0;

  while (turns < MAX_TURNS) {
    const p = players[currentPlayer];
    const topDiscard = discardPile[discardPile.length - 1];

    // Call Lolos when 1–2 cards left
    if (p.hand.length <= 2 && !p.calledLolos)
      p.calledLolos = true;

    // Win check
    if (p.hand.length === 0 && p.calledLolos)
      return { finished: true, turns, winnerIndex: currentPlayer };

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    const targets = generateValidTargets(d1, d2, d3);

    let played = false;
    // 1) Play number card matching a target
    for (const t of targets) {
      const idx = p.hand.findIndex(c => c.type === 'number' && c.value === t);
      if (idx >= 0) {
        const card = p.hand.splice(idx, 1)[0];
        discardPile.push(card);
        played = true;
        break;
      }
    }
    if (!played && opts.addWild && targets.length > 0) {
      const wildIdx = p.hand.findIndex(c => c.type === 'wild');
      if (wildIdx >= 0) {
        const card = p.hand.splice(wildIdx, 1)[0];
        discardPile.push(card);
        played = true;
      }
    }
    if (!played) {
      // 2) Play identical to top discard
      const idx = p.hand.findIndex(c => identical(c, topDiscard));
      if (idx >= 0) {
        const card = p.hand.splice(idx, 1)[0];
        discardPile.push(card);
        played = true;
      }
    }
    if (!played) {
      // 3) Draw one
      let dp = drawPile;
      let dsc = discardPile;
      ({ drawPile: dp, discardPile: dsc } = reshuffle(dp, dsc));
      if (dp.length > 0) {
        p.hand.push(dp[0]);
        drawPile = dp.slice(1);
        discardPile = dsc;
      } else {
        drawPile = dp;
        discardPile = dsc;
      }
    }

    turns++;
    currentPlayer = (currentPlayer + 1) % NUM_PLAYERS;
  }

  return { finished: false, turns: MAX_TURNS, winnerIndex: null };
}

// --- Run many games and aggregate ---
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const k = (sortedArr.length - 1) * (p / 100);
  const f = Math.floor(k);
  const c = Math.ceil(k);
  if (f === c) return sortedArr[f];
  return sortedArr[f] * (c - k) + sortedArr[c] * (k - f);
}

function runBatch(n, addWild) {
  const results = [];
  const turnCounts = [];
  for (let i = 0; i < n; i++) {
    const r = runOneGame({ addWild });
    results.push(r);
    if (r.finished) turnCounts.push(r.turns);
  }
  const finished = results.filter(r => r.finished).length;
  const turnsOnly = turnCounts.slice().sort((a, b) => a - b);
  const meanTurns = turnCounts.length ? turnCounts.reduce((s, t) => s + t, 0) / turnCounts.length : 0;
  const medianTurns = turnCounts.length ? percentile(turnsOnly, 50) : 0;
  const buckets = [0, 0, 0, 0, 0];
  for (const t of turnCounts) {
    if (t <= 20) buckets[0]++;
    else if (t <= 40) buckets[1]++;
    else if (t <= 60) buckets[2]++;
    else if (t <= 80) buckets[3]++;
    else buckets[4]++;
  }
  return {
    n,
    addWild,
    finished,
    pFinish: finished / n,
    meanTurns: Math.round(meanTurns * 10) / 10,
    medianTurns: Math.round(medianTurns * 10) / 10,
    histogram: buckets,
  };
}

function runSimulation() {
  const half = Math.floor(NUM_GAMES / 2);
  console.log(`Running ${NUM_GAMES} games (${half} × 15 שברים בלי פרא, ${half} × 15 שברים + קלף פרא), max ${MAX_TURNS} turns each...`);
  console.log('  גרסה א: 15 קלפי שבר (6,3,3,3) — בלי פרא');
  const batchNoWild = runBatch(half, false);
  if (half >= 1000) console.log(`  ${half}/${NUM_GAMES} גרסה א הסתיימה`);
  console.log('  גרסה ב: 15 קלפי שבר + 4 קלפי פרא');
  const batchWild = runBatch(half, true);
  return { batchNoWild, batchWild, totalGames: NUM_GAMES, maxTurns: MAX_TURNS };
}

const report = runSimulation();
const a = report.batchNoWild;
const b = report.batchWild;
const labels = ['1-20', '21-40', '41-60', '61-80', '81+'];

// Console
console.log('\n--- דיווח סימולציה לולוס (3 שחקנים, 7 קלפים) ---\n');
console.log('גרסה א — 15 קלפי שבר (6,3,3,3), בלי פרא:');
console.log(`  ניצחונות: ${a.finished} / ${a.n}  |  P(סיום): ${(a.pFinish * 100).toFixed(2)}%  |  ממוצע תורות: ${a.meanTurns}  |  חציון: ${a.medianTurns}`);
console.log('\nגרסה ב — 15 קלפי שבר + 4 קלפי פרא:');
console.log(`  ניצחונות: ${b.finished} / ${b.n}  |  P(סיום): ${(b.pFinish * 100).toFixed(2)}%  |  ממוצע תורות: ${b.meanTurns}  |  חציון: ${b.medianTurns}`);
console.log('\nהתפלגות גרסה א:', a.histogram.join(', '));
console.log('התפלגות גרסה ב:', b.histogram.join(', '));

// Write markdown report
const docsDir = path.join(__dirname, '..', 'docs');
const reportPath = path.join(docsDir, 'simulation-report-3players.md');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

const md = `# דיווח סימולציה — לולוס (3 שחקנים, 7 קלפים)

נוצר על ידי \`node card/scripts/simulate-lolos.js\`. חצי משחקים עם 15 קלפי שבר (בלי פרא), חצי עם 15 שברים + 4 קלפי פרא.

## פרמטרים

- **סה"כ משחקים:** ${report.totalGames} (${a.n} גרסה א, ${b.n} גרסה ב)
- **שחקנים:** ${NUM_PLAYERS}  |  קלפים ביד: ${CARDS_PER_PLAYER}
- **חפיסה:** 0–25, 15 קלפי שבר (1/2×6, 1/3×3, 1/4×3, 1/5×3). גרסה ב: +4 קלפי פרא.
- **מכסת תורות מקס:** ${report.maxTurns}

## גרסה א — 15 קלפי שבר (בלי פרא)

| מדד | ערך |
|-----|-----|
| ניצחונות | ${a.finished} / ${a.n} |
| **P(סיום)** | **${(a.pFinish * 100).toFixed(2)}%** |
| **ממוצע תורות עד ניצחון** | **${a.meanTurns}** |
| חציון תורות | ${a.medianTurns} |

התפלגות: ${labels.map((l, i) => `${l}=${a.histogram[i]}`).join(', ')}

## גרסה ב — 15 שברים + קלף פרא (4 פרא)

| מדד | ערך |
|-----|-----|
| ניצחונות | ${b.finished} / ${b.n} |
| **P(סיום)** | **${(b.pFinish * 100).toFixed(2)}%** |
| **ממוצע תורות עד ניצחון** | **${b.meanTurns}** |
| חציון תורות | ${b.medianTurns} |

התפלגות: ${labels.map((l, i) => `${l}=${b.histogram[i]}`).join(', ')}

## קלף פרא

קלף פרא נספר ככל מספר 0–25: כשמונחים על הערימה (לפי תוצאת הקוביות), נחשבים כערך שמתאים לתוצאה. מגדיל את הסיכוי להניח קלף בתור ולכן את שיעור הניצחונות.

## שיטת הסימולציה

- רובוט: קודם קלף מספר שתואם תוצאת קוביות; אם יש פרא — פרא כתוצאה; אחרת קלף זהה לערימה; אחרת שלוף.
- לולוס ב־1–2 קלפים, ניצחון כשיד ריקה.
`;

fs.writeFileSync(reportPath, md, 'utf8');
console.log(`\nדיווח נשמר: ${reportPath}`);
process.exit(0);
