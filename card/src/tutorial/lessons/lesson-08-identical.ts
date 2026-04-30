// ============================================================
// lesson-08-identical.ts — Final advanced lesson: mini-card copy.
// The learner opens the mini-strip, picks a mini result card, then
// copies the FULL equation shown on the chip in the EquationBuilder.
// ============================================================

import type { Lesson } from './types';

export const lesson08Identical: Lesson = {
  id: 'mini-copy-next-turn',
  titleKey: 'tutorial.l9.title',
  descKey: 'tutorial.l9.desc',
  steps: [
    {
      id: 'mini-copy',
      botDemo: async (api) => {
        // Brief settle time before await-mimic opens with everything active.
        await api.wait(1200);
      },
      outcome: (e) => e.kind === 'l6CopyConfirmed',
      hintKey: 'tutorial.l9.copy.hint',
      botHintKey: 'tutorial.l9.copy.bot',
      celebrateKey: 'tutorial.l9.copy.celebrate',
    },
  ],
};
