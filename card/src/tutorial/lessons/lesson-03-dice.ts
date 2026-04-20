// ============================================================
// lesson-03-dice.ts — Third watch-and-mimic lesson: the dice.
// Bot points at the gold dice button, the learner taps it, the
// dice land, and the celebration line says "these are the
// numbers we'll build an exercise with".
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
        // Brief pause so the host can swap the underlying game phase
        // (turn-transition → pre-roll) and mount the GoldDiceButton +
        // its tutorialBus subscriber before we pulse it.
        await api.wait(450);
        await api.pulseDiceBtn(PULSE_MS);
      },
      outcome: (event) => event.kind === 'diceRolled',
      highlight: { target: 'dice', shape: 'ring' },
      hintKey: 'tutorial.l3.hintRoll',
      botHintKey: 'tutorial.l3.botRoll',
      celebrateKey: 'tutorial.l3.celebrate',
    },
  ],
};
