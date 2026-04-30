// ============================================================
// lesson-10-multi-play.ts — Multi-play tip: stage 2+ cards
// whose sum equals the equation result, discarding them all
// in one turn. Opens with a "did you know?" intro overlay.
// ============================================================

import type { Lesson } from './types';

export const lesson10MultiPlay: Lesson = {
  id: 'multi-play-tip',
  titleKey: 'tutorial.l11.title',
  descKey: 'tutorial.l11.desc',
  steps: [
    {
      id: 'multi-play-exercise',
      botDemo: async (api) => {
        await api.wait(800);
      },
      outcome: (e) => e.kind === 'userPlayedCards',
      hintKey: 'tutorial.multiPlayExercise.hint',
      celebrateKey: 'tutorial.multiPlayExercise.celebrate',
    },
    {
      id: 'multi-play-exercise-2',
      botDemo: async (api) => {
        await api.wait(0);
      },
      outcome: (e) => e.kind === 'userPlayedCards' && (e.count ?? 0) > 2 && !!e.hasZero,
      hintKey: 'tutorial.multiPlayExerciseMore.hint',
      celebrateKey: 'tutorial.multiPlayExercise.celebrate',
    },
  ],
};
