// ============================================================
// lesson-09-identical.ts — Single identical-card play.
// The learner is in pre-roll with one card matching the top of
// the discard pile. They tap it to skip the dice roll entirely.
// ============================================================

import type { Lesson } from './types';

export const lesson09Identical: Lesson = {
  id: 'identical-single',
  titleKey: 'tutorial.l10.title',
  descKey: 'tutorial.l10.desc',
  steps: [
    {
      id: 'identical-single-play',
      botDemo: async (api) => {
        await api.wait(1000);
      },
      outcome: (e) => e.kind === 'identicalPlayed',
      hintKey: 'tutorial.l10.hint',
      celebrateKey: 'tutorial.l10.celebrate',
    },
  ],
};
