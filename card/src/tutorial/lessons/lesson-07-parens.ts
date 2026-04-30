// ============================================================
// lesson-07-parens.ts — Advanced module: moving parentheses.
//
// Step 0 (move-parens): Learner sees a pre-filled equation and
// toggles parentheses to the right side. Auto-confirms when correct.
//
// Step 1 (full-build): Learner picks a mini card showing a target
// result, then builds the full equation (dice + operators + parens)
// from scratch.
// ============================================================

import type { Lesson } from './types';

export const lesson07Parens: Lesson = {
  id: 'parens-move',
  titleKey: 'tutorial.l8.title',
  descKey: 'tutorial.l8.desc',
  steps: [
    {
      id: 'move-parens',
      botDemo: async (api) => {
        await api.wait(1600);
      },
      outcome: (e) => e.kind === 'l7ParensCopyConfirmed',
      celebrateKey: 'tutorial.l8.celebrate',
    },
    {
      id: 'full-build',
      botDemo: async (api) => {
        await api.wait(800);
      },
      outcome: (e) => e.kind === 'userPlayedCards',
      hintKey: 'tutorial.l8.step2.hint',
      botHintKey: 'tutorial.l8.copyFullExercise',
      celebrateKey: 'tutorial.l8.step2.celebrate',
    },
  ],
};
