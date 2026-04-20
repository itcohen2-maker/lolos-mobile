// ============================================================
// lesson-06-fractions-advanced.ts — Optional module after signs:
// intro → theory ack → attack ½ → attack ⅓ → defend vs ½ → defend vs ⅓
// Game state is rigged per step in InteractiveTutorialScreen.
// ============================================================

import type { Lesson } from './types';

export const lesson06FractionsAdvanced: Lesson = {
  id: 'fractions-advanced',
  titleKey: 'tutorial.l6.title',
  descKey: 'tutorial.l6.desc',
  steps: [
    {
      id: 'frac-intro',
      botDemo: async (api) => {
        await api.wait(500);
      },
      outcome: (e) => e.kind === 'fracLessonAck',
      hintKey: 'tutorial.l6.intro.hint',
      botHintKey: 'tutorial.l6.intro.bot',
      celebrateKey: 'tutorial.l6.intro.celebrate',
    },
    {
      id: 'frac-theory',
      botDemo: async (api) => {
        await api.wait(500);
      },
      outcome: (e) => e.kind === 'fracLessonAck',
      hintKey: 'tutorial.l6.theory.hint',
      botHintKey: 'tutorial.l6.theory.bot',
      celebrateKey: 'tutorial.l6.theory.celebrate',
    },
    {
      id: 'frac-attack-half',
      botDemo: async (api) => {
        await api.wait(600);
      },
      outcome: (e) => e.kind === 'fracAttackPlayed' && e.fraction === '1/2',
      hintKey: 'tutorial.l6.attackHalf.hint',
      botHintKey: 'tutorial.l6.attackHalf.bot',
      celebrateKey: 'tutorial.l6.attackHalf.celebrate',
    },
    {
      id: 'frac-attack-third',
      botDemo: async (api) => {
        await api.wait(600);
      },
      outcome: (e) => e.kind === 'fracAttackPlayed' && e.fraction === '1/3',
      hintKey: 'tutorial.l6.attackThird.hint',
      botHintKey: 'tutorial.l6.attackThird.bot',
      celebrateKey: 'tutorial.l6.attackThird.celebrate',
    },
    {
      id: 'frac-defend-half',
      botDemo: async (api) => {
        await api.wait(600);
      },
      outcome: (e) => e.kind === 'fracDefenseSolved' && e.penaltyDenom === 2,
      hintKey: 'tutorial.l6.defendHalf.hint',
      botHintKey: 'tutorial.l6.defendHalf.bot',
      celebrateKey: 'tutorial.l6.defendHalf.celebrate',
    },
    {
      id: 'frac-defend-third',
      botDemo: async (api) => {
        await api.wait(600);
      },
      outcome: (e) => e.kind === 'fracDefenseSolved' && e.penaltyDenom === 3,
      hintKey: 'tutorial.l6.defendThird.hint',
      botHintKey: 'tutorial.l6.defendThird.bot',
      celebrateKey: 'tutorial.l6.defendThird.celebrate',
    },
  ],
};
