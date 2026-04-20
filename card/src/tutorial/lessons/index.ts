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
import { lesson06FractionsAdvanced } from './lesson-06-fractions-advanced';
import type { Lesson } from './types';

export const LESSONS: Lesson[] = [
  lesson01Fan,
  lesson02Tap,
  lesson03Dice,
  lesson04Equation,
  lesson05OpCycle,
  lesson06FractionsAdvanced,
];

export type { Lesson, LessonStep, OutcomePredicate, HighlightSpec } from './types';
