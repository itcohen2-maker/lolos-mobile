#!/usr/bin/env node
/**
 * בדיקת וריאנטים — השוואת השפעת שינויים על P(סיום) וממוצע תורות
 * הרצה: node card/scripts/simulate-variants.js [משחקים_לכל_וריאנט]
 * ברירת מחדל: 500 משחקים לכל וריאנט
 */

const fs = require('fs');
const path = require('path');

const NUM_PLAYERS = 3;
const MAX_TURNS = parseInt(process.env.MAX_TURNS || '300', 10);
const GAMES_PER_VARIANT = parseInt(process.argv[2] || '500', 10);
const WILD_COUNT = 4;

let cardId = 0;
function makeId() { return `c${++cardId}`; }

function generateDeck(v) {
  cardId = 0;
  const cards = [];
  const maxNum = v.easy ? 12 : 25;
  const copies = v.threeCopies ? 3 : 4;
  for (let set = 0; set < copies; set++)
    for (let n = 0; n <= maxNum; n++)
      cards.push({ id: makeId(), type: 'number', value: n });
  const fracs = v.fewerFrac
    ? [[4, '1/2'], [2, '1/3'], [2, '1/4'], [2, '1/5']]
    : [[6, '1/2'], [3, '1/3'], [3, '1/4'], [3, '1/5']];
  for (const [count, frac] of fracs)
    for (let i = 0; i < count; i++)
      cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  const opCount = v.fewerOps ? 2 : 4;
  for (const op of ['+', '-', 'x', '÷'])
    for (let i = 0; i < opCount; i++)
      cards.push({ id: makeId(), type: 'operation', operation: op });
  for (let i = 0; i < 4; i++)
    cards.push({ id: makeId(), type: 'joker' });
  if (v.wild)
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
        if (r !== null && r >= 0 && Number.isInteger(r)) results.push(r);
        const lr1 = applyOp(a, op1, b);
        if (lr1 !== null) {
          const lr = applyOp(lr1, op2, c);
          if (lr !== null && lr >= 0 && Number.isInteger(lr)) results.push(lr);
        }
      }
    }
  }
  const pairs = [[values[0], values[1]], [values[0], values[2]], [values[1], values[2]]];
  for (const [a, b] of pairs) {
    for (const op of ALL_OPS) {
      for (const [x, y] of [[a, b], [b, a]]) {
        const r = applyOp(x, op, y);
        if (r !== null && r >= 0 && Number.isInteger(r) && r <= 25) results.push(r);
      }
    }
  }
  return [...new Set(results)].filter(r => r >= 0 && r <= 25);
}

function identical(card, top) {
  if (!top || card.type !== top.type) return false;
  if (card.type === 'number') return card.value === top.value;
  if (card.type === 'fraction') return card.fraction === top.fraction;
  if (card.type === 'operation') return card.operation === top.operation;
  if (card.type === 'joker') return top.type === 'joker';
  return false;
}

function fractionDenom(frac) {
  if (frac === '1/2') return 2;
  if (frac === '1/3') return 3;
  if (frac === '1/4') return 4;
  if (frac === '1/5') return 5;
  return 2;
}
function isDivisibleByFraction(value, frac) {
  const d = fractionDenom(frac);
  return value > 0 && value % d === 0;
}

function reshuffle(drawPile, discardPile) {
  if (drawPile.length > 0 || discardPile.length <= 1) return { drawPile, discardPile };
  const top = discardPile[discardPile.length - 1];
  const rest = discardPile.slice(0, -1);
  return { drawPile: shuffle(rest), discardPile: [top] };
}

function runOneGame(v, cardsPerPlayer) {
  const deck = shuffle(generateDeck(v));
  const { hands, remaining } = deal(deck, NUM_PLAYERS, cardsPerPlayer);
  let drawPile = remaining;
  let discardPile = [];
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
  const players = hands.map(h => ({ hand: [...h], calledLolos: false }));
  let current = 0, turns = 0;

  while (turns < MAX_TURNS) {
    const p = players[current];
    const top = discardPile[discardPile.length - 1];
    if (p.hand.length <= 2 && !p.calledLolos) p.calledLolos = true;
    if (p.hand.length === 0 && p.calledLolos)
      return { finished: true, turns, winnerIndex: current };

    const d1 = Math.floor(Math.random() * 6) + 1, d2 = Math.floor(Math.random() * 6) + 1, d3 = Math.floor(Math.random() * 6) + 1;
    const targets = generateValidTargets(d1, d2, d3);
    let played = false;

    for (const t of targets) {
      const idx = p.hand.findIndex(c => c.type === 'number' && c.value === t);
      if (idx >= 0) {
        discardPile.push(p.hand.splice(idx, 1)[0]);
        played = true;
        break;
      }
    }
    if (!played && v.wild && targets.length > 0) {
      const wi = p.hand.findIndex(c => c.type === 'wild');
      if (wi >= 0) {
        discardPile.push(p.hand.splice(wi, 1)[0]);
        played = true;
      }
    }
    if (!played) {
      const idx = p.hand.findIndex(c => identical(c, top));
      if (idx >= 0) {
        discardPile.push(p.hand.splice(idx, 1)[0]);
        played = true;
      }
    }
    if (!played && top.type === 'fraction') {
      const idx = p.hand.findIndex(c => c.type === 'fraction');
      if (idx >= 0) {
        discardPile.push(p.hand.splice(idx, 1)[0]);
        played = true;
      }
    }
    if (!played && top.type === 'number' && top.value != null) {
      const idx = p.hand.findIndex(c => c.type === 'fraction' && isDivisibleByFraction(top.value, c.fraction));
      if (idx >= 0) {
        discardPile.push(p.hand.splice(idx, 1)[0]);
        played = true;
      }
    }
    if (!played) {
      let dp = drawPile, dsc = discardPile;
      ({ drawPile: dp, discardPile: dsc } = reshuffle(dp, dsc));
      if (dp.length > 0) {
        p.hand.push(dp[0]);
        drawPile = dp.slice(1);
        discardPile = dsc;
      } else { drawPile = dp; discardPile = dsc; }
    }
    turns++;
    current = (current + 1) % NUM_PLAYERS;
  }
  return { finished: false, turns: MAX_TURNS, winnerIndex: null };
}

function runVariant(name, v, cardsPerPlayer, n) {
  const turnCounts = [];
  for (let i = 0; i < n; i++) {
    const r = runOneGame(v, cardsPerPlayer);
    if (r.finished) turnCounts.push(r.turns);
  }
  const finished = turnCounts.length;
  const mean = turnCounts.length ? turnCounts.reduce((s, t) => s + t, 0) / turnCounts.length : 0;
  return {
    name,
    finished,
    n,
    pFinish: (finished / n * 100).toFixed(1),
    meanTurns: Math.round(mean * 10) / 10,
  };
}

const variants = [
  { id: 'baseline', name: 'בסיס: 7 קלפים, 4 עותקים, 15 שברים', v: { easy: false, threeCopies: false, fewerFrac: false, fewerOps: false, wild: false }, cards: 7 },
  { id: '8cards', name: '8 קלפים ביד (במקום 7)', v: { easy: false, threeCopies: false, fewerFrac: false, fewerOps: false, wild: false }, cards: 8 },
  { id: '3copies', name: '3 עותקים למספר (במקום 4)', v: { easy: false, threeCopies: true, fewerFrac: false, fewerOps: false, wild: false }, cards: 7 },
  { id: 'wild', name: 'קלף פרא (+4 פרא)', v: { easy: false, threeCopies: false, fewerFrac: false, fewerOps: false, wild: true }, cards: 7 },
  { id: 'fewerDead', name: 'פחות שברים/פעולות (10 שברים, 2 פעולה)', v: { easy: false, threeCopies: false, fewerFrac: true, fewerOps: true, wild: false }, cards: 7 },
  { id: 'easy', name: 'מצב קל: 0–12, 3 עותקים, פחות שברים', v: { easy: true, threeCopies: true, fewerFrac: true, fewerOps: false, wild: false }, cards: 7 },
];

console.log(`\nהרצת ${variants.length} וריאנטים, ${GAMES_PER_VARIANT} משחקים לכל אחד, max ${MAX_TURNS} תורות\n`);

const results = [];
for (const { name, v, cards } of variants) {
  process.stdout.write(`  ${name}... `);
  const r = runVariant(name, v, cards, GAMES_PER_VARIANT);
  results.push(r);
  console.log(`${r.finished}/${r.n} ניצחונות, P=${r.pFinish}%, ממוצע=${r.meanTurns}`);
}

const reportPath = path.join(__dirname, '..', 'docs', 'simulation-variants-report.md');
const docsDir = path.dirname(reportPath);
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

let md = `# השוואת וריאנטים — השפעה על ניצחונות וממוצע תורות

נוצר: \`node card/scripts/simulate-variants.js ${GAMES_PER_VARIANT}\`
משחקים לכל וריאנט: ${GAMES_PER_VARIANT}  |  מכסת תורות: ${MAX_TURNS}  |  3 שחקנים

| שינוי | ניצחונות | P(סיום) | ממוצע תורות |
|-------|----------|---------|-------------|
`;
for (const r of results) {
  md += `| ${r.name} | ${r.finished} / ${r.n} | ${r.pFinish}% | ${r.meanTurns} |\n`;
}
md += `
## הסבר וריאנטים

- **בסיס:** 7 קלפים ביד, 4 עותקים 0–25, 15 קלפי שבר (6,3,3,3), 4 פעולות×4, 4 ג'וקרים.
- **8 קלפים:** כמו בסיס אבל 8 קלפים לשחקן.
- **3 עותקים:** כמו בסיס אבל 3 עותקים לכל מספר (חפיסה קטנה יותר).
- **קלף פרא:** כמו בסיס + 4 קלפי פרא (נספרים ככל מספר 0–25).
- **פחות קלפים מתים:** 10 קלפי שבר (4,2,2,2), 2 פעולות לכל סוג.
- **מצב קל:** מספרים 0–12, 3 עותקים, 10 שברים (פחות).
`;

fs.writeFileSync(reportPath, md, 'utf8');
console.log(`\nדיווח נשמר: ${reportPath}`);
process.exit(0);
