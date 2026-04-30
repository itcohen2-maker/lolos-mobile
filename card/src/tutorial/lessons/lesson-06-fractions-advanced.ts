// ============================================================
// lesson-06-fractions-advanced.ts — Optional module after signs:
// intro → attack ½ → attack ⅓
// Game state is rigged per step in InteractiveTutorialScreen.
// ============================================================

import type { Lesson } from './types';

export const lesson06FractionsAdvanced: Lesson = {
  id: 'fractions-advanced',
  titleKey: 'tutorial.l7.title',
  descKey: 'tutorial.l7.desc',
  steps: [
    // Step 0: intro — custom UI, tap "הבנתי — בוא ננסה".
    {
      id: 'frac-intro',
      botDemo: async (_api) => { /* instant */ },
      outcome: (e) => e.kind === 'fracLessonAck',
      celebrateKey: 'tutorial.l7.intro.celebrate',
    },
    // Step 1: attack with ½.
    {
      id: 'frac-attack-half',
      botDemo: async (api) => { await api.wait(3500); },
      outcome: (e) => e.kind === 'fracAttackPlayed' && e.fraction === '1/2',
      hintKey: 'tutorial.l7.attackHalf.hint',
      botHintKey: 'tutorial.l7.attackHalf.bot',
      celebrateKey: 'tutorial.l7.attackHalf.celebrate',
    },
    // Step 2: attack with ⅓.
    {
      id: 'frac-attack-third',
      botDemo: async (api) => { await api.wait(2800); },
      outcome: (e) => e.kind === 'fracAttackPlayed' && e.fraction === '1/3',
      hintKey: 'tutorial.l7.attackThird.hint',
      botHintKey: 'tutorial.l7.attackThird.bot',
      celebrateKey: 'tutorial.l7.attackThird.celebrate',
    },
  ],
};
