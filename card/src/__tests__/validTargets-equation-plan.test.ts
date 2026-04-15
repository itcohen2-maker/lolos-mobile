/**
 * תוכנית בדיקה: validTargets / בונה משוואות / שלבי A–H / שרת
 * @see shared/difficultyStages.ts, server/src/equations.ts, server/src/gameEngine.ts
 */

import type { DiceResult, Operation, ServerGameState, HostGameSettings, Player } from '../../shared/types';
import { DIFFICULTY_STAGE_CONFIG, type DifficultyStageId } from '../../shared/difficultyStages';
import * as equations from '../../server/src/equations';
import { buildEqOpDisplayCycle, displayOpToOperationToken } from '../../shared/equationOpCycle';
import { doRollDice, confirmEquation } from '../../server/src/gameEngine';

const { generateValidTargets, evalThreeTerms, applyOperation } = equations;

function permutations3(values: number[]): number[][] {
  if (values.length <= 1) return [values];
  const result: number[][] = [];
  for (let i = 0; i < values.length; i++) {
    const rest = [...values.slice(0, i), ...values.slice(i + 1)];
    for (const perm of permutations3(rest)) result.push([values[i], ...perm]);
  }
  return result;
}

/** כל תוצאות שלמות אפשריות מ־3 קוביות + 2 קוביות, רק עם allowedOps */
function bruteForceIntegerResults(
  dice: DiceResult,
  allowedOps: Operation[],
  allowNegativeTargets: boolean,
  maxTarget: number,
): Set<number> {
  const out = new Set<number>();
  const values = [dice.die1, dice.die2, dice.die3];
  for (const [a, b, c] of permutations3(values)) {
    for (const op1 of allowedOps) {
      for (const op2 of allowedOps) {
        const r = evalThreeTerms(a, op1, b, op2, c);
        if (r === null || !Number.isInteger(r)) continue;
        if (!allowNegativeTargets && r < 0) continue;
        if (r <= maxTarget) out.add(r);
      }
    }
  }
  const pairs: [number, number][] = [
    [values[0], values[1]],
    [values[0], values[2]],
    [values[1], values[2]],
  ];
  for (const [a, b] of pairs) {
    for (const op of allowedOps) {
      for (const pair of [
        [a, b] as [number, number],
        [b, a] as [number, number],
      ]) {
        const r = applyOperation(pair[0], op, pair[1]);
        if (r === null || !Number.isInteger(r)) continue;
        if (!allowNegativeTargets && r < 0) continue;
        if (r <= maxTarget) out.add(r);
      }
    }
  }
  return out;
}

function targetResultSet(
  dice: DiceResult,
  cfg: { enabledOperators: Operation[]; allowNegativeTargets: boolean; rangeMax: 12 | 25 },
) {
  return new Set(
    generateValidTargets(dice, cfg.enabledOperators, cfg.allowNegativeTargets, cfg.rangeMax).map((t) => t.result),
  );
}

function minimalPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p0',
    name: 'Test',
    hand: [],
    calledLolos: false,
    isConnected: true,
    isHost: true,
    isBot: false,
    afkWarnings: 0,
    isEliminated: false,
    isSpectator: false,
    locale: 'he',
    ...overrides,
  };
}

function baseHostSettings(overrides: Partial<HostGameSettings> = {}): HostGameSettings {
  return {
    diceMode: '3',
    showFractions: true,
    showPossibleResults: true,
    showSolveExercise: true,
    mathRangeMax: 25,
    enabledOperators: ['+', '-'],
    allowNegativeTargets: false,
    timerSetting: 'off',
    timerCustomSeconds: 60,
    ...overrides,
  };
}

function minimalServerState(partial: {
  phase: ServerGameState['phase'];
  hostGameSettings?: Partial<HostGameSettings>;
  validTargets?: ServerGameState['validTargets'];
  dice?: DiceResult | null;
}): ServerGameState {
  const hostGameSettings = baseHostSettings(partial.hostGameSettings ?? {});
  return {
    roomCode: 'TEST',
    phase: partial.phase,
    players: [minimalPlayer()],
    currentPlayerIndex: 0,
    drawPile: [],
    discardPile: [{ id: 'd0', type: 'number', value: 5 }],
    dice: partial.dice ?? null,
    diceRollSeq: 0,
    validTargets: partial.validTargets ?? [],
    equationResult: null,
    stagedCards: [],
    pendingFractionTarget: null,
    fractionPenalty: 0,
    fractionAttackResolved: false,
    hasPlayedCards: false,
    hasDrawnCard: false,
    lastCardValue: null,
    consecutiveIdenticalPlays: 0,
    identicalCelebration: null,
    lastMoveMessage: null,
    lastEquationDisplay: null,
    difficulty: 'full',
    hostGameSettings,
    winner: null,
    message: '',
    openingDrawId: 'opening-test',
    turnDeadlineAt: null,
    equationCommits: [],
    tournamentTable: [{ playerIndex: 0, playerName: 'Test', wins: 0, losses: 0 }],
  };
}

describe('validTargets vs equation plan (smoke 1,4,6)', () => {
  const dice146: DiceResult = { die1: 1, die2: 4, die3: 6 };

  it('שלב C (± בלבד): 23 מ־(6×4)−1 לא ברשימה — כפל לא מותר ב־validTargets', () => {
    const cfg = DIFFICULTY_STAGE_CONFIG.C;
    const results = targetResultSet(dice146, cfg);
    expect(results.has(23)).toBe(false);
  });

  it('שלב G (×÷ בלבד): 23 לא אפשרי בלי חיסור; תוצאה כמו 24 כן (6×4×1)', () => {
    const cfg = DIFFICULTY_STAGE_CONFIG.G;
    const results = targetResultSet(dice146, cfg);
    expect(results.has(23)).toBe(false);
    expect(results.has(24)).toBe(true);
  });

  it('evalThreeTerms(6,x,4,-,1) === 23 (אורקל מתמטי)', () => {
    expect(evalThreeTerms(6, 'x', 4, '-', 1)).toBe(23);
  });

  it('סדר תצוגה קבוע d1 op1 d2 op2 d3 תואם evalThreeTerms (לא (d1+d2)*d3 בלי לשנות חישוב)', () => {
    expect(evalThreeTerms(1, '+', 2, 'x', 4)).toBe(9);
    expect(evalThreeTerms(1, '+', 2, '+', 4)).toBe(7);
  });
});

/** לוגיקת מונה הצ'יפ ורשימת תוצאות מסוננת — כמו index.tsx (matchCount / filteredResultsForHand) */
function filteredResultsForHandMock(
  validTargets: { result: number }[],
  handNumberValues: number[],
  hasWild: boolean,
) {
  void hasWild;
  const nums = new Set(handNumberValues);
  return validTargets.filter((t) => nums.has(t.result));
}

function matchCountMock(validTargets: { result: number }[], handNumberValues: number[], hasWild: boolean) {
  void hasWild;
  return validTargets.filter((t) => handNumberValues.includes(t.result)).length;
}

describe('תוצאות אפשריות: סינון ליד מול מונה צ׳יפ (כמו index.tsx)', () => {
  const vt = [{ result: 3 }, { result: 11 }, { result: 23 }, { result: 24 }];
  it('בלי פרא — רק תוצאות שיש להן קלף מספר ביד', () => {
    const hand = [3, 11, 10, 23];
    const filtered = filteredResultsForHandMock(vt, hand, false);
    expect(filtered.map((x) => x.result).sort((a, b) => a - b)).toEqual([3, 11, 23]);
    expect(matchCountMock(vt, hand, false)).toBe(3);
  });
  it('עם פרא — עדיין מוצגות רק תוצאות שיש להן קלף מספר ביד', () => {
    expect(filteredResultsForHandMock(vt, [3], true).map((x) => x.result)).toEqual([3]);
    expect(matchCountMock(vt, [3], true)).toBe(1);
  });
});

describe('buildEqOpDisplayCycle (UI מול שלב)', () => {
  it('A–D: רק + − במחזור', () => {
    expect(buildEqOpDisplayCycle(DIFFICULTY_STAGE_CONFIG.C.enabledOperators)).toEqual([null, '+', '-']);
  });
  it('E–H: רק × ÷ במחזור (× כתצוגה)', () => {
    expect(buildEqOpDisplayCycle(DIFFICULTY_STAGE_CONFIG.G.enabledOperators)).toEqual([null, '×', '÷']);
  });
  it('displayOpToOperationToken', () => {
    expect(displayOpToOperationToken('×')).toBe('x');
    expect(displayOpToOperationToken('*')).toBe('x');
    expect(displayOpToOperationToken('+')).toBe('+');
    expect(displayOpToOperationToken('/')).toBe('÷');
    expect(displayOpToOperationToken(null)).toBe(null);
  });
});

describe('מטריצת שלבים × brute force מול generateValidTargets', () => {
  const edgeDice: DiceResult[] = [
    { die1: 1, die2: 1, die3: 1 },
    { die1: 6, die2: 6, die3: 6 },
    { die1: 1, die2: 2, die3: 3 },
    { die1: 2, die2: 3, die3: 6 },
    { die1: 1, die2: 4, die3: 6 },
  ];

  const stages: DifficultyStageId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (const stageId of stages) {
    const cfg = DIFFICULTY_STAGE_CONFIG[stageId];
    for (const dice of edgeDice) {
      it(`שלב ${stageId} קוביות ${dice.die1},${dice.die2},${dice.die3} — קבוצת תוצאות תואמת brute`, () => {
        const brute = bruteForceIntegerResults(dice, cfg.enabledOperators, cfg.allowNegativeTargets, cfg.rangeMax);
        const gen = targetResultSet(dice, cfg);
        expect(gen.size).toBe(brute.size);
        for (const r of brute) expect(gen.has(r)).toBe(true);
        for (const r of gen) expect(brute.has(r)).toBe(true);
      });
    }
  }
});

describe('property: כל קוביות 1–6 × כל שלב (מחזור יחיד)', () => {
  it('קבוצת תוצאות === brute לכל 216 צירופי קוביות ושמונה שלבים', () => {
    const stages: DifficultyStageId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const d1 of [1, 2, 3, 4, 5, 6]) {
      for (const d2 of [1, 2, 3, 4, 5, 6]) {
        for (const d3 of [1, 2, 3, 4, 5, 6]) {
          const dice: DiceResult = { die1: d1, die2: d2, die3: d3 };
          for (const stageId of stages) {
            const cfg = DIFFICULTY_STAGE_CONFIG[stageId];
            const brute = bruteForceIntegerResults(dice, cfg.enabledOperators, cfg.allowNegativeTargets, cfg.rangeMax);
            const gen = targetResultSet(dice, cfg);
            expect(gen.size).toBe(brute.size);
            for (const r of brute) expect(gen.has(r)).toBe(true);
            for (const r of gen) expect(brute.has(r)).toBe(true);
          }
        }
      }
    }
  });
});

describe('מולטיפלייר: doRollDice / confirmEquation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('doRollDice ממלא validTargets כמו generateValidTargets ישירות', () => {
    jest.spyOn(equations, 'rollDice').mockReturnValue({ die1: 1, die2: 4, die3: 6 });
    const st = minimalServerState({
      phase: 'pre-roll',
      hostGameSettings: { enabledOperators: ['x', '÷'], mathRangeMax: 25, allowNegativeTargets: false },
    });
    const out = doRollDice(st);
    if ('error' in out) throw new Error(JSON.stringify(out.error));
    const expected = generateValidTargets({ die1: 1, die2: 4, die3: 6 }, ['x', '÷'], false, 25);
    expect(out.validTargets.map((x) => x.result).sort((a, b) => a - b)).toEqual(
      expected.map((x) => x.result).sort((a, b) => a - b),
    );
  });

  it('mathRangeMax חסר ב־host → ברירת מחדל 12 ב־doRollDice (סינון מחמיר)', () => {
    jest.spyOn(equations, 'rollDice').mockReturnValue({ die1: 6, die2: 6, die3: 1 });
    const st = minimalServerState({
      phase: 'pre-roll',
      hostGameSettings: {
        enabledOperators: ['x', '÷'],
        allowNegativeTargets: false,
        mathRangeMax: undefined,
      },
    });
    const out = doRollDice(st);
    if ('error' in out) throw new Error(JSON.stringify(out.error));
    const expected = generateValidTargets({ die1: 6, die2: 6, die3: 1 }, ['x', '÷'], false, 12);
    expect(out.validTargets.map((t) => t.result).sort((a, b) => a - b)).toEqual(
      expected.map((t) => t.result).sort((a, b) => a - b),
    );
  });

  it('confirmEquation דוחה תוצאה שלא ב־validTargets', () => {
    const st = minimalServerState({
      phase: 'building',
      dice: { die1: 1, die2: 1, die3: 1 },
      validTargets: [{ equation: '1+1+1=3', result: 3 }],
    });
    const bad = confirmEquation(st, 99, 'fake = 99');
    expect('error' in bad && bad.error.key).toBe('equation.invalidResult');
    const good = confirmEquation(st, 3, '1+1+1=3');
    if ('error' in good) throw new Error(JSON.stringify(good.error));
    expect(good.phase).toBe('solved');
    expect(good.equationResult).toBe(3);
  });
});
