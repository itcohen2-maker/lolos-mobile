/**
 * Shared bot plan enumeration + difficulty pick (local vs-bot + server bot).
 */

import type { BotDifficulty, Card, EquationCommitPayload } from './types';

export type { BotDifficulty };

export type BotStagedPlanPick = {
  target: number;
  equationDisplay: string;
  stagedCardIds: string[];
  equationCommits: EquationCommitPayload[];
};

type InternalPlan = BotStagedPlanPick & { score: number };

/** Optional RNG for tests / replay; defaults to Math.random. */
export type PickBotPlanOptions = {
  rng?: () => number;
};

const EASY_BLUNDER_CHANCE = 0.2;
const MEDIUM_RANDOM_BRANCH = 0.25;

function pickFromPlans(
  plans: InternalPlan[],
  difficulty: BotDifficulty,
  rng: () => number,
): BotStagedPlanPick | null {
  if (plans.length === 0) return null;
  const scores = plans.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const strip = (p: InternalPlan): BotStagedPlanPick => ({
    target: p.target,
    equationDisplay: p.equationDisplay,
    stagedCardIds: p.stagedCardIds,
    equationCommits: p.equationCommits,
  });

  switch (difficulty) {
    case 'hard': {
      const tier = plans.filter((p) => p.score === maxScore);
      return strip(tier[0]!);
    }
    case 'easy': {
      if (rng() < EASY_BLUNDER_CHANCE) {
        const suboptimal = plans.filter((p) => p.score < maxScore);
        if (suboptimal.length > 0) {
          return strip(suboptimal[Math.floor(rng() * suboptimal.length)]!);
        }
      }
      return strip(plans[Math.floor(rng() * plans.length)]!);
    }
    case 'medium': {
      if (rng() < MEDIUM_RANDOM_BRANCH) {
        return strip(plans[Math.floor(rng() * plans.length)]!);
      }
      const ideal = (minScore + maxScore) / 2;
      let best = plans[0]!;
      let bestDist = Math.abs(best.score - ideal);
      for (const p of plans) {
        const d = Math.abs(p.score - ideal);
        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      return strip(best);
    }
    default: {
      const _e: never = difficulty;
      void _e;
      return null;
    }
  }
}

/**
 * Enumerate valid (number+wild) staging subsets per valid target and pick one plan by difficulty.
 */
export function pickBotStagedPlan(
  validTargets: readonly { result: number; equation: string }[],
  candidates: Card[],
  equationCommits: EquationCommitPayload[],
  maxWild: number,
  validateStagedCards: (
    staged: Card[],
    opCard: null,
    target: number,
    maxWildArg: number,
  ) => boolean,
  difficulty: BotDifficulty,
  options?: PickBotPlanOptions,
): BotStagedPlanPick | null {
  const rng = options?.rng ?? Math.random;
  const plans: InternalPlan[] = [];
  const totalMasks = 1 << candidates.length;
  for (const option of validTargets) {
    for (let mask = 1; mask < totalMasks; mask++) {
      const stagedCards: Card[] = [];
      let wildCount = 0;
      let operationCount = 0;
      for (let index = 0; index < candidates.length; index++) {
        if ((mask & (1 << index)) === 0) continue;
        const card = candidates[index]!;
        if (card.type === 'wild') wildCount++;
        if (card.type === 'operation') operationCount++;
        stagedCards.push(card);
      }
      if (wildCount > 1) continue;
      if (operationCount > 1) continue;
      const numberCards = stagedCards.filter(
        (card) => card.type === 'number' || card.type === 'wild',
      );
      if (numberCards.length === 0) continue;
      const opCard = stagedCards.find((card) => card.type === 'operation') ?? null;
      if (!validateStagedCards(numberCards, opCard, option.result, maxWild)) continue;
      const score = stagedCards.length + equationCommits.length;
      plans.push({
        target: option.result,
        equationDisplay: option.equation,
        // Stage only numbers/wilds in solved phase; operation cards belong to equation commits.
        stagedCardIds: numberCards.map((c) => c.id),
        equationCommits,
        score,
      });
    }
  }
  return pickFromPlans(plans, difficulty, rng);
}

/**
 * Delay between bot micro-steps (ms): [min, max] inclusive jitter.
 * Longer delays on easier levels so players can read the exercise; Hard is still the fastest tier.
 */
export function botStepDelayRange(difficulty: BotDifficulty): { min: number; max: number } {
  switch (difficulty) {
    case 'easy':
      return { min: 2200, max: 2800 };
    case 'medium':
      return { min: 1900, max: 2400 };
    case 'hard':
      return { min: 1800, max: 2200 };
    default: {
      const _e: never = difficulty;
      void _e;
      return { min: 2800, max: 4200 };
    }
  }
}
