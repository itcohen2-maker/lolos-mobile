#!/usr/bin/env node
/**
 * 0..12 simulation, all operators (+,-,x,÷), with configurable fraction kinds.
 * Variants:
 *  - half-third only: 1/2, 1/3
 *  - all fractions:   1/2, 1/3, 1/4, 1/5
 *
 * Simplified baseline policy, aligned with previous research scripts.
 */
const fs = require('fs');
const path = require('path');

const NUM_PLAYERS = 3;
const CARDS_PER_PLAYER = 7;
const MAX_NUM = 12;
const COPIES_NUMBERS = 4;
const GAMES_PER_VARIANT = parseInt(process.argv[2] || '20000', 10);
const MAX_TURNS = parseInt(process.env.MAX_TURNS || '400', 10);
const ALLOW_NEGATIVE_TARGETS = true;
const OUT_JSON = path.join(__dirname, '..', 'docs', 'research', 'research-0-12-all-ops-fractions.json');

let cardId = 0;
function makeId() { cardId += 1; return `c${cardId}`; }

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
  for (let c = 0; c < perPlayer; c++) {
    for (let p = 0; p < nPlayers; p++) if (idx < deck.length) hands[p].push(deck[idx++]);
  }
  return { hands, remaining: deck.slice(idx) };
}

function fractionDenom(frac) {
  if (frac === '1/2') return 2;
  if (frac === '1/3') return 3;
  if (frac === '1/4') return 4;
  if (frac === '1/5') return 5;
  return 2;
}

function generateDeck(fractionKinds) {
  cardId = 0;
  const cards = [];
  for (let set = 0; set < COPIES_NUMBERS; set++) {
    for (let v = 0; v <= MAX_NUM; v++) cards.push({ id: makeId(), type: 'number', value: v });
  }

  const fractionBase = [
    ['1/2', 6],
    ['1/3', 4],
    ['1/4', 3],
    ['1/5', 2],
  ];
  const allow = new Set(fractionKinds);
  for (const [frac, count] of fractionBase) {
    if (!allow.has(frac)) continue;
    for (let i = 0; i < count; i++) cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  }

  for (const op of ['+', '-', 'x', '÷']) {
    const count = op === '÷' ? 3 : 4;
    for (let i = 0; i < count; i++) cards.push({ id: makeId(), type: 'operation', operation: op });
  }
  for (let i = 0; i < 4; i++) cards.push({ id: makeId(), type: 'joker' });
  for (let i = 0; i < 3; i++) cards.push({ id: makeId(), type: 'wild' });
  return cards;
}

function rollDice() {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

function applyOperation(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === 'x' || op === '*' || op === '×') return a * b;
  if (op === '÷' || op === '/') return b !== 0 && a % b === 0 ? a / b : null;
  return null;
}

function isHighPrecedence(op) {
  return op === 'x' || op === '*' || op === '×' || op === '÷' || op === '/';
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

function uniqueTargetResults() {
  const values = rollDice();
  const results = new Set();
  const ops = ['+', '-', 'x', '÷'];
  const perms = [
    [values[0], values[1], values[2]],
    [values[0], values[2], values[1]],
    [values[1], values[0], values[2]],
    [values[1], values[2], values[0]],
    [values[2], values[0], values[1]],
    [values[2], values[1], values[0]],
  ];
  for (const [a, b, c] of perms) {
    for (const op1 of ops) {
      for (const op2 of ops) {
        const r = evalThreeTerms(a, op1, b, op2, c);
        if (r !== null && Number.isInteger(r) && (ALLOW_NEGATIVE_TARGETS || r >= 0) && r <= MAX_NUM) results.add(r);
      }
    }
  }
  const pairs = [[values[0], values[1]], [values[0], values[2]], [values[1], values[2]]];
  for (const [a, b] of pairs) {
    for (const op of ops) {
      const r1 = applyOperation(a, op, b);
      const r2 = applyOperation(b, op, a);
      if (r1 !== null && Number.isInteger(r1) && (ALLOW_NEGATIVE_TARGETS || r1 >= 0) && r1 <= MAX_NUM) results.add(r1);
      if (r2 !== null && Number.isInteger(r2) && (ALLOW_NEGATIVE_TARGETS || r2 >= 0) && r2 <= MAX_NUM) results.add(r2);
    }
  }
  return results;
}

function validateIdenticalPlay(card, topDiscard) {
  if (!topDiscard) return false;
  if (card.type === 'wild') return topDiscard.type === 'number' || topDiscard.type === 'wild';
  if (card.type !== topDiscard.type) return false;
  if (card.type === 'number') return card.value === topDiscard.value;
  if (card.type === 'fraction') return card.fraction === topDiscard.fraction;
  if (card.type === 'operation') return card.operation === topDiscard.operation;
  if (card.type === 'joker') return topDiscard.type === 'joker';
  return false;
}

function reshuffle(drawPile, discardPile) {
  if (drawPile.length > 0 || discardPile.length <= 1) return { drawPile, discardPile };
  const top = discardPile[discardPile.length - 1];
  return { drawPile: shuffle(discardPile.slice(0, -1)), discardPile: [top] };
}

function drawOne(drawPile, discardPile) {
  let dp = drawPile;
  let dsc = discardPile;
  ({ drawPile: dp, discardPile: dsc } = reshuffle(dp, dsc));
  if (dp.length === 0) return { drawPile: dp, discardPile: dsc, drawn: null };
  return { drawPile: dp.slice(1), discardPile: dsc, drawn: dp[0] };
}

function isDivisibleByFraction(value, frac) {
  const d = fractionDenom(frac);
  return value > 0 && value % d === 0;
}

function runOneGame(fractionKinds) {
  const deck = shuffle(generateDeck(fractionKinds));
  const { hands, remaining } = deal(deck, NUM_PLAYERS, CARDS_PER_PLAYER);
  let drawPile = remaining;
  let discardPile = [];
  let pendingFractionTarget = null;
  let fractionPenalty = 0;

  let firstNumberIdx = drawPile.findIndex((c) => c.type === 'number');
  if (firstNumberIdx < 0) firstNumberIdx = 0;
  discardPile.push(drawPile[firstNumberIdx]);
  drawPile = [...drawPile.slice(0, firstNumberIdx), ...drawPile.slice(firstNumberIdx + 1)];

  const players = hands.map((hand) => ({ hand: [...hand] }));
  let current = Math.floor(Math.random() * NUM_PLAYERS);

  for (let turns = 1; turns <= MAX_TURNS; turns++) {
    const p = players[current];
    if (p.hand.length <= 2) return { finished: true, turns: turns - 1 };

    let moved = false;
    const top = discardPile[discardPile.length - 1];

    // fraction defense window
    if (pendingFractionTarget !== null) {
      const defendIdx = p.hand.findIndex((c) => c.type === 'number' && c.value > 0 && c.value % fractionPenalty === 0);
      if (defendIdx >= 0) {
        discardPile.push(p.hand.splice(defendIdx, 1)[0]);
        moved = true;
      } else {
        const drawCount = fractionPenalty;
        for (let i = 0; i < drawCount; i++) {
          const d = drawOne(drawPile, discardPile);
          drawPile = d.drawPile;
          discardPile = d.discardPile;
          if (d.drawn) p.hand.push(d.drawn);
        }
      }
      pendingFractionTarget = null;
      fractionPenalty = 0;
      if (moved && p.hand.length <= 2) return { finished: true, turns };
      current = (current + 1) % NUM_PLAYERS;
      continue;
    }

    // equation-like play
    const targets = uniqueTargetResults();
    const nIdx = p.hand.findIndex((c) => c.type === 'number' && targets.has(c.value));
    if (nIdx >= 0) {
      discardPile.push(p.hand.splice(nIdx, 1)[0]);
      moved = true;
    } else {
      const wIdx = p.hand.findIndex((c) => c.type === 'wild');
      if (wIdx >= 0 && targets.size > 0) {
        const chosen = [...targets][0];
        const wc = { ...p.hand[wIdx], resolvedValue: chosen };
        p.hand.splice(wIdx, 1);
        discardPile.push(wc);
        moved = true;
      }
    }

    // identical
    if (!moved) {
      const iIdx = p.hand.findIndex((c) => validateIdenticalPlay(c, top));
      if (iIdx >= 0) {
        const c = p.hand.splice(iIdx, 1)[0];
        if (c.type === 'wild' && (top.type === 'number' || top.type === 'wild')) {
          const resolvedValue = top.type === 'number' ? top.value : top.resolvedValue;
          discardPile.push({ ...c, resolvedValue });
        } else {
          discardPile.push(c);
        }
        moved = true;
      }
    }

    // fraction attack
    if (!moved && top.type === 'number' && top.value != null) {
      const fIdx = p.hand.findIndex((c) => c.type === 'fraction' && isDivisibleByFraction(top.value, c.fraction));
      if (fIdx >= 0) {
        const fracCard = p.hand.splice(fIdx, 1)[0];
        discardPile.push(fracCard);
        pendingFractionTarget = top.value / fractionDenom(fracCard.fraction);
        fractionPenalty = fractionDenom(fracCard.fraction);
        moved = true;
      }
    }

    // draw
    if (!moved) {
      const d = drawOne(drawPile, discardPile);
      drawPile = d.drawPile;
      discardPile = d.discardPile;
      if (d.drawn) p.hand.push(d.drawn);
    }

    if (moved && p.hand.length <= 2) return { finished: true, turns };
    current = (current + 1) % NUM_PLAYERS;
  }
  return { finished: false, turns: MAX_TURNS };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function runVariant(name, fractionKinds) {
  const finishTurns = [];
  let finished = 0;
  for (let i = 0; i < GAMES_PER_VARIANT; i++) {
    const r = runOneGame(fractionKinds);
    if (r.finished) {
      finished += 1;
      finishTurns.push(r.turns);
    }
  }
  finishTurns.sort((a, b) => a - b);
  const mean = finishTurns.length ? finishTurns.reduce((s, x) => s + x, 0) / finishTurns.length : null;
  const probsAt = [30, 50, 100, 200, 400];
  const cdf = {};
  for (const n of probsAt) {
    const cnt = finishTurns.filter((t) => t <= n).length;
    cdf[`finish_lte_${n}`] = GAMES_PER_VARIANT > 0 ? cnt / GAMES_PER_VARIANT : 0;
  }
  return {
    name,
    fractionKinds,
    games: GAMES_PER_VARIANT,
    finishedGames: finished,
    finishRate: finished / GAMES_PER_VARIANT,
    meanTurnsAmongFinished: mean,
    minObservedTurns: finishTurns.length ? finishTurns[0] : null,
    p50Turns: percentile(finishTurns, 50),
    p90Turns: percentile(finishTurns, 90),
    p95Turns: percentile(finishTurns, 95),
    p99Turns: percentile(finishTurns, 99),
    probabilities: cdf,
  };
}

const variants = [
  { name: 'fractions_half_third', fractionKinds: ['1/2', '1/3'] },
  { name: 'fractions_all', fractionKinds: ['1/2', '1/3', '1/4', '1/5'] },
];

const results = variants.map((v) => runVariant(v.name, v.fractionKinds));
const payload = {
  generatedAt: new Date().toISOString(),
  config: {
    maxNumber: MAX_NUM,
    includeFractions: true,
    enabledOperators: ['+', '-', 'x', '÷'],
    players: NUM_PLAYERS,
    cardsPerPlayer: CARDS_PER_PLAYER,
    gamesPerVariant: GAMES_PER_VARIANT,
    maxTurns: MAX_TURNS,
    model: 'simplified policy simulation (equation/identical/fraction/draw)',
  },
  results,
};

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');

console.log(`Saved: ${OUT_JSON}`);
for (const r of results) {
  console.log(`${r.name}: ${r.finishedGames}/${r.games} (${(100 * r.finishRate).toFixed(2)}%), mean=${r.meanTurnsAmongFinished ? r.meanTurnsAmongFinished.toFixed(2) : 'N/A'}`);
}
