// ============================================================
// lessons/index.ts — Registry of all watch-and-mimic lessons.
// User feeds new lessons one-by-one; append them here as they
// land.
// ============================================================

import { lesson01Fan } from './lesson-01-fan';
import { lesson02Tap } from './lesson-02-tap';
import { lesson03Dice } from './lesson-03-dice';
import { lesson04Equation } from './lesson-04-equation';
import { lesson05OpCycle } from './lesson-05-op-cycle';
import { lesson06PossibleResults } from './lesson-06-possible-results';
import { lesson06FractionsAdvanced } from './lesson-06-fractions-advanced';
import { lesson07Parens } from './lesson-07-parens';
import { lesson08Identical } from './lesson-08-identical';
import { lesson09Identical } from './lesson-09-identical';
import { lesson10MultiPlay } from './lesson-10-multi-play';
import type { Lesson } from './types';

export const LESSONS: Lesson[] = [
  lesson01Fan,
  lesson02Tap,
  lesson03Dice,
  lesson04Equation,
  lesson05OpCycle,
  lesson06PossibleResults,
  // Index 6 — optional fractions module.
  lesson06FractionsAdvanced,
  // Index 7 — advanced parens-move lesson (follows fractions).
  lesson07Parens,
  // Index 8 — single identical-card play (follows parens).
  lesson09Identical,
  // Index 9 — multi-play tip (final advanced lesson).
  lesson10MultiPlay,
];

export type { Lesson, LessonStep, OutcomePredicate, HighlightSpec } from './types';
