// ============================================================
// lesson-03-dice.ts — Third watch-and-mimic lesson: the dice.
// The dice are now revealed automatically so the learner sees
// the exact numbers that will feed the next exercise, without
// an extra "roll to continue" interaction.
// ============================================================

import type { Lesson } from './types';

const PULSE_MS = 1800;

export const lesson03Dice: Lesson = {
  id: 'dice-basics',
  titleKey: 'tutorial.l3.title',
  descKey: 'tutorial.l3.desc',
  steps: [
    {
      id: 'roll-dice',
      botDemo: async (api) => {
        // Give the learner a short beat to see the dice appear before the
        // engine moves into the next tutorial phase.
        await api.wait(PULSE_MS);
      },
      outcome: (event) => event.kind === 'diceRolled',
      highlight: { target: 'dice', shape: 'ring' },
      hintKey: 'tutorial.l3.hintRoll',
      botHintKey: 'tutorial.l3.botRoll',
      celebrateKey: 'tutorial.l3.celebrate',
    },
    {
      id: 'solved-preview',
      botDemo: async (api) => {
        await api.wait(650);
      },
      outcome: (event) => event.kind === 'l3SolvedAck',
      highlight: { target: 'eq-area', shape: 'ring' },
      botHintKey: 'tutorial.l3.previewBot',
      celebrateKey: 'tutorial.l3.previewCelebrate',
    },
  ],
};
