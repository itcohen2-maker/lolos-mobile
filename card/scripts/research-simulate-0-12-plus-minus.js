#!/usr/bin/env node
/**
 * Research simulation for:
 * - number cards 0..12
 * - no fractions
 * - + / - operators only
 * - default table shape: 3 players, 7 cards per player
 * - win condition: hand size <= 2 (matches server checkWin)
 *
 * This is a simplified policy simulation (not full game-engine AI).
 * It estimates finish likelihood and turn counts under a consistent baseline policy.
 */

const fs = require('fs');
const path = require('path');

const NUM_PLAYERS = 3;
const CARDS_PER_PLAYER = 7;
const MAX_NUM = 12;
const COPIES_NUMBERS = 4;
const GAMES = parseInt(process.argv[2] || '10000', 10);
const MAX_TURNS = parseInt(process.env.MAX_TURNS || '400', 10);
const ALLOW_NEGATIVE_TARGETS = true; // mirrors default host setting

const OUT_JSON = path.join(__dirname, '..', 'docs', 'research', 'research-0-12-plus-minus.json');

let cardId = 0;
function makeId() {
  cardId += 1;
  return `c${cardId}`;
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
  for (let c = 0; c < perPlayer; c++) {
    for (let p = 0; p < nPlayers; p++) {
      if (idx < deck.length) hands[p].push(deck[idx++]);
    }
  }
  return { hands, remaining: deck.slice(idx) };
}

function generateDeck() {
  cardId = 0;
  const cards = [];

  for (let set = 0; set < COPIES_NUMBERS; set++) {
    for (let v = 0; v <= MAX_NUM; v++) {
      cards.push({ id: makeId(), type: 'number', value: v });
    }
  }

  for (const op of ['+', '-']) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: makeId(), type: 'operation', operation: op });
    }
  }

  for (let i = 0; i < 4; i++) cards.push({ id: makeId(), type: 'joker' });
  for (let i = 0; i < 3; i++) cards.push({ id: makeId(), type: 'wild' });

  return cards;
}

function rollDice() {
  // Mirrors equations.ts rollDice(): randomInt(1, 7)
  return [
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
  ];
}

function applyOperation(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  return null;
}

function evalThreeTerms(a, op1, b, op2, c) {
  const left = applyOperation(a, op1, b);
  if (left === null) return null;
  return applyOperation(left, op2, c);
}

function uniqueTargetResults(dice) {
  const [d1, d2, d3] = dice;
  const values = [d1, d2, d3];
  const results = new Set();
  const ops = ['+', '-'];
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
        if (r !== null && Number.isInteger(r) && (ALLOW_NEGATIVE_TARGETS || r >= 0) && r <= MAX_NUM) {
          results.add(r);
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
    for (const op of ops) {
      const r1 = applyOperation(a, op, b);
      const r2 = applyOperation(b, op, a);
      if (r1 !== null && Number.isInteger(r1) && (ALLOW_NEGATIVE_TARGETS || r1 >= 0) && r1 <= MAX_NUM) {
        results.add(r1);
      }
      if (r2 !== null && Number.isInteger(r2) && (ALLOW_NEGATIVE_TARGETS || r2 >= 0) && r2 <= MAX_NUM) {
        results.add(r2);
      }
    }
  }

  return results;
}

function validateIdenticalPlay(card, topDiscard) {
  if (!topDiscard) return false;
  if (card.type === 'wild') return topDiscard.type === 'number' || topDiscard.type === 'wild';
  if (card.type !== topDiscard.type) return false;
  if (card.type === 'number') return card.value === topDiscard.value;
  if (card.type === 'operation') return card.operation === topDiscard.operation;
  if (card.type === 'joker') return topDiscard.type === 'joker';
  return false;
}

function reshuffle(drawPile, discardPile) {
  if (drawPile.length > 0 || discardPile.length <= 1) return { drawPile, discardPile };
  const top = discardPile[discardPile.length - 1];
  const rest = discardPile.slice(0, -1);
  return { drawPile: shuffle(rest), discardPile: [top] };
}

function drawOne(drawPile, discardPile) {
  let dp = drawPile;
  let dsc = discardPile;
  ({ drawPile: dp, discardPile: dsc } = reshuffle(dp, dsc));
  if (dp.length === 0) return { drawPile: dp, discardPile: dsc, drawn: null };
  return {
    drawPile: dp.slice(1),
    discardPile: dsc,
    drawn: dp[0],
  };
}

function runOneGame() {
  const deck = shuffle(generateDeck());
  const { hands, remaining } = deal(deck, NUM_PLAYERS, CARDS_PER_PLAYER);
  let drawPile = remaining;
  let discardPile = [];

  // Start discard pile with first number card (same intent as gameEngine)
  let firstNumberIdx = drawPile.findIndex((c) => c.type === 'number');
  if (firstNumberIdx < 0) firstNumberIdx = 0;
  discardPile.push(drawPile[firstNumberIdx]);
  drawPile = [...drawPile.slice(0, firstNumberIdx), ...drawPile.slice(firstNumberIdx + 1)];

  const players = hands.map((hand) => ({ hand: [...hand] }));
  let currentPlayerIndex = Math.floor(Math.random() * NUM_PLAYERS);

  for (let turns = 1; turns <= MAX_TURNS; turns++) {
    const player = players[currentPlayerIndex];

    if (player.hand.length <= 2) {
      return { finished: true, turns: turns - 1, winnerIndex: currentPlayerIndex };
    }

    let moved = false;

    // 1) Equation-like move: discard one matching number card (or wild as fallback).
    const targets = uniqueTargetResults(rollDice());
    let bestTargetCardIdx = -1;
    for (let i = 0; i < player.hand.length; i++) {
      const c = player.hand[i];
      if (c.type === 'number' && targets.has(c.value)) {
        bestTargetCardIdx = i;
        break;
      }
    }
    if (bestTargetCardIdx >= 0) {
      discardPile.push(player.hand.splice(bestTargetCardIdx, 1)[0]);
      moved = true;
    } else {
      const wildIdx = player.hand.findIndex((c) => c.type === 'wild');
      if (wildIdx >= 0 && targets.size > 0) {
        const chosen = [...targets][0];
        const wc = { ...player.hand[wildIdx], resolvedValue: chosen };
        player.hand.splice(wildIdx, 1);
        discardPile.push(wc);
        moved = true;
      }
    }

    // 2) Fallback identical play if no equation-like move.
    if (!moved) {
      const top = discardPile[discardPile.length - 1];
      const identicalIdx = player.hand.findIndex((c) => validateIdenticalPlay(c, top));
      if (identicalIdx >= 0) {
        const c = player.hand.splice(identicalIdx, 1)[0];
        if (c.type === 'wild' && (top.type === 'number' || top.type === 'wild')) {
          const resolvedValue = top.type === 'number' ? top.value : top.resolvedValue;
          discardPile.push({ ...c, resolvedValue });
        } else {
          discardPile.push(c);
        }
        moved = true;
      }
    }

    // 3) If still no move, draw one and end turn.
    if (!moved) {
      const d = drawOne(drawPile, discardPile);
      drawPile = d.drawPile;
      discardPile = d.discardPile;
      if (d.drawn) player.hand.push(d.drawn);
    }

    // Server checks win immediately after a successful discard action.
    if (moved && player.hand.length <= 2) {
      return { finished: true, turns, winnerIndex: currentPlayerIndex };
    }

    currentPlayerIndex = (currentPlayerIndex + 1) % NUM_PLAYERS;
  }

  return { finished: false, turns: MAX_TURNS, winnerIndex: null };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function runSimulation() {
  const finishTurns = [];
  let finished = 0;

  for (let i = 0; i < GAMES; i++) {
    const r = runOneGame();
    if (r.finished) {
      finished += 1;
      finishTurns.push(r.turns);
    }
  }

  finishTurns.sort((a, b) => a - b);
  const mean =
    finishTurns.length > 0
      ? finishTurns.reduce((sum, x) => sum + x, 0) / finishTurns.length
      : null;

  const probsAt = [30, 50, 100, 200, 400];
  const cdf = {};
  for (const n of probsAt) {
    const cnt = finishTurns.filter((t) => t <= n).length;
    cdf[`finish_lte_${n}`] = GAMES > 0 ? cnt / GAMES : 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    config: {
      numPlayers: NUM_PLAYERS,
      cardsPerPlayer: CARDS_PER_PLAYER,
      maxNumber: MAX_NUM,
      includeFractions: false,
      enabledOperators: ['+', '-'],
      allowNegativeTargets: ALLOW_NEGATIVE_TARGETS,
      dice: '3d6 (1..6 each)',
      games: GAMES,
      maxTurns: MAX_TURNS,
      model: 'simplified policy simulation (equation-match -> identical -> draw)',
    },
    theoretical: {
      minTurnsAbsoluteLowerBound: 1,
      rationale:
        'Player starts with 7 cards and wins at <=2, so must discard at least 5 cards. In principle this can happen in one winning turn under favorable state.',
    },
    outcomes: {
      finishedGames: finished,
      finishRate: GAMES > 0 ? finished / GAMES : 0,
      meanTurnsAmongFinished: mean,
      minObservedTurns: finishTurns.length > 0 ? finishTurns[0] : null,
      p50Turns: percentile(finishTurns, 50),
      p90Turns: percentile(finishTurns, 90),
      p95Turns: percentile(finishTurns, 95),
      p99Turns: percentile(finishTurns, 99),
      probabilities: cdf,
    },
  };
}

const result = runSimulation();
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2), 'utf8');

console.log(`Saved: ${OUT_JSON}`);
console.log(`Finished: ${result.outcomes.finishedGames}/${GAMES} (${(100 * result.outcomes.finishRate).toFixed(1)}%)`);
console.log(`Mean turns (finished only): ${result.outcomes.meanTurnsAmongFinished === null ? 'N/A' : result.outcomes.meanTurnsAmongFinished.toFixed(2)}`);
console.log(`P(finish<=100): ${(100 * result.outcomes.probabilities.finish_lte_100).toFixed(1)}%`);
