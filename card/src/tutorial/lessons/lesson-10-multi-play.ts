// ============================================================
// lesson-10-multi-play.ts — Multi-play tip: stage 2+ cards
// whose sum equals the equation result, discarding them all
// in one turn. Opens with a "הידעת?" intro overlay.
// The rigged addends (addA, addB) are published by
// InteractiveTutorialScreen via tutorialBus.setL11Config()
// before this botDemo runs.
// ============================================================

import type { Lesson } from './types';

export const lesson10MultiPlay: Lesson = {
  id: 'multi-play-tip',
  titleKey: 'tutorial.l11.title',
  descKey: 'tutorial.l11.desc',
  steps: [
    {
      // Step 0 — הידעת? intro screen (rendered by InteractiveTutorialScreen).
      // botDemo just waits; the screen shows the overlay. outcome fires when
      // the learner taps "בוא ננסה".
      id: 'multi-play-intro',
      botDemo: async (api) => {
        await api.wait(500);
      },
      outcome: (e) => e.kind === 'identicalMultiAck',
    },
    {
      // Step 1 — learner stages addA + addB (random, set by rigging) and confirms.
      // Bot reads addA/addB from tutorialBus.getL11Config() so the demo always
      // matches the randomised hand.
      id: 'multi-play-act',
      botDemo: async (api) => {
        await api.wait(800);
        const cfg = api.l11Config();
        if (cfg) {
          await api.stageCardByValue(cfg.addA);
          await api.stageCardByValue(cfg.addB);
        }
        await api.eqConfirm();
      },
      outcome: (e) => e.kind === 'userPlayedCards',
      hintKey: 'tutorial.l11.step1.hint',
      celebrateKey: 'tutorial.l11.step1.celebrate',
    },
  ],
};
