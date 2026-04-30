#!/usr/bin/env node
/**
 * סימולציה מפושטת: חפיסה 0..maxNum, שברים כמו deck.ts, רק +/−, 3 קוביות 0–10.
 * מודל שחקן כמו simulate-variants.js (מניסיון יעד מספר, אחרת זהה, שבר על מספר מתחלק).
 *
 * הרצה: node scripts/research-simulate-0-10-15.js [משחקים_לכל_וריאנט]
 * ברירת מחדל: 2000
 */

const fs = require('fs');
const path = require('path');

const NUM_PLAYERS = 3;
const MAX_TURNS = parseInt(process.env.MAX_TURNS || '400', 10);
const GAMES_PER_VARIANT = parseInt(process.argv[2] || '2000', 10);
const OUT_JSON = path.join(__dirname, '..', 'docs', 'research', 'research-0-10-15-simulation.json');

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
            results.push({ result: r });
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
          results.push({ result: r1 });
        }
      }
      const r2 = applyOperation(b, op, a);
      if (r2 !== null && (allowNegativeTargets || r2 >= 0) && Number.isInteger(r2)) {
        const eq2 = `${b} ${op} ${a} = ${r2}`;
        if (!seen.has(`${r2}:${eq2}`)) {
          seen.add(`${r2}:${eq2}`);
          results.push({ result: r2 });
        }
      }
    }
  }

  const uniq = new Set();
  for (const opt of results) {
    if ((allowNegativeTargets || opt.result >= 0) && opt.result <= maxTarget) uniq.add(opt.result);
  }
  return [...uniq];
}

let cardId = 0;
function makeId() {
  return `c${++cardId}`;
}

/** חפיסה: מספרים 0..maxNum, עותקים; שברים כמו server deck; 4× + ו־4× −; 4 קלפי סלינדה */
function generateDeck(maxNum, copies, includeFractions) {
  cardId = 0;
  const cards = [];
  for (let set = 0; set < copies; set++)
    for (let v = 0; v <= maxNum; v++) cards.push({ id: makeId(), type: 'number', value: v });

  if (includeFractions) {
    const fracs = [
      ['1/2', 6],
      ['1/3', 4],
      ['1/4', 3],
      ['1/5', 2],
    ];
    for (const [frac, count] of fracs)
      for (let i = 0; i < count; i++) cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  }

  for (const op of ['+', '-'])
    for (let i = 0; i < 4; i++) cards.push({ id: makeId(), type: 'operation', operation: op });

  for (let i = 0; i < 4; i++) cards.push({ id: makeId(), type: 'joker' });

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
    for (let p = 0; p < nPlayers; p++) if (idx < deck.length) hands[p].push(deck[idx++]);
  return { hands, remaining: deck.slice(idx) };
}

function rollDice010() {
  return {
    die1: Math.floor(Math.random() * 11),
    die2: Math.floor(Math.random() * 11),
    die3: Math.floor(Math.random() * 11),
  };
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

function runOneGame(opts) {
  const { maxNum, copies, includeFractions, allowNegativeTargets, cardsPerPlayer } = opts;
  const deck = shuffle(generateDeck(maxNum, copies, includeFractions));
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
  let current = 0;
  let turns = 0;

  while (turns < MAX_TURNS) {
    const p = players[current];
    const top = discardPile[discardPile.length - 1];
    if (p.hand.length <= 2 && !p.calledLolos) p.calledLolos = true;
    if (p.hand.length === 0 && p.calledLolos) return { finished: true, turns, winnerIndex: current };

    const dice = rollDice010();
    const targets = generateValidTargets(dice.die1, dice.die2, dice.die3, allowNegativeTargets, maxNum);
    let played = false;

    for (const t of targets) {
      const idx = p.hand.findIndex(c => c.type === 'number' && c.value === t);
      if (idx >= 0) {
        discardPile.push(p.hand.splice(idx, 1)[0]);
        played = true;
        break;
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
    current = (current + 1) % NUM_PLAYERS;
  }
  return { finished: false, turns: MAX_TURNS, winnerIndex: null };
}

function runVariant(name, opts) {
  const turnCounts = [];
  for (let i = 0; i < GAMES_PER_VARIANT; i++) {
    const r = runOneGame(opts);
    if (r.finished) turnCounts.push(r.turns);
  }
  const finished = turnCounts.length;
  const mean = turnCounts.length ? turnCounts.reduce((s, t) => s + t, 0) / turnCounts.length : 0;
  return {
    name,
    ...opts,
    games: GAMES_PER_VARIANT,
    finished,
    pFinishPct: (finished / GAMES_PER_VARIANT) * 100,
    meanTurns: Math.round(mean * 10) / 10,
  };
}

const variants = [
  {
    name: 'קלפים 0–10, 3 עותקים, שברים, ללא יעדים שליליים',
    maxNum: 10,
    copies: 3,
    includeFractions: true,
    allowNegativeTargets: false,
    cardsPerPlayer: 7,
  },
  {
    name: 'קלפים 0–15, 3 עותקים, שברים, ללא יעדים שליליים',
    maxNum: 15,
    copies: 3,
    includeFractions: true,
    allowNegativeTargets: false,
    cardsPerPlayer: 7,
  },
  {
    name: 'קלפים 0–10, 3 עותקים, בלי שברים',
    maxNum: 10,
    copies: 3,
    includeFractions: false,
    allowNegativeTargets: false,
    cardsPerPlayer: 7,
  },
  {
    name: 'קלפים 0–15, 3 עותקים, בלי שברים',
    maxNum: 15,
    copies: 3,
    includeFractions: false,
    allowNegativeTargets: false,
    cardsPerPlayer: 7,
  },
  {
    name: 'קלפים 0–10, 4 עותקים, שברים',
    maxNum: 10,
    copies: 4,
    includeFractions: true,
    allowNegativeTargets: false,
    cardsPerPlayer: 7,
  },
  {
    name: 'קלפים 0–15, 4 עותקים, שברים',
    maxNum: 15,
    copies: 4,
    includeFractions: true,
    allowNegativeTargets: false,
    cardsPerPlayer: 7,
  },
];

console.log(`\n${variants.length} וריאנטים, ${GAMES_PER_VARIANT} משחקים, עד ${MAX_TURNS} תורות, 3 שחקנים\n`);

const results = [];
for (const v of variants) {
  process.stdout.write(`  ${v.name.slice(0, 40)}... `);
  const { name, ...opts } = v;
  const r = runVariant(name, opts);
  results.push(r);
  console.log(`${r.finished}/${r.games} סיום, P=${r.pFinishPct.toFixed(1)}%, ממוצע תורות=${r.meanTurns}`);
}

const payload = {
  generatedAt: new Date().toISOString(),
  maxTurnsCap: MAX_TURNS,
  numPlayers: NUM_PLAYERS,
  gamesPerVariant: GAMES_PER_VARIANT,
  dice: 'אחיד 0–10 לכל קוביה (3 קוביות)',
  operations: '+ / − בלבד בחישוב יעדים; חפיסה כוללת קלפי פעולה + ו־− בלבד',
  disclaimer: 'מודל שחקן פשוט כמו simulate-variants.js — לא אסטרטגיה אנושית.',
  results,
};

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
console.log(`\nנשמר: ${OUT_JSON}`);
