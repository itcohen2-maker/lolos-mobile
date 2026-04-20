// ============================================================
// lesson-05-op-cycle.ts — Fifth lesson: operation symbols.
//
// Scratch canvas rendered by InteractiveTutorialScreen. Two
// random numbers flank a `?` operation slot; the result on the
// right updates live as the learner changes the sign. Below
// the equation sit four operation cards (+, −, ×, ÷) and a
// joker card.
//
// Step 5a (cycle): the learner taps the `?` slot to cycle the
// sign; after they've seen all four symbols the step advances.
// Step 5b (joker): the learner taps the joker card → picks a
// sign in the modal → taps the slot to place it.
// Step 5c (solve-for-op): two exercises with known result —
// learner picks the sign that makes the equation true, then
// taps "אשר את התרגיל" to confirm. Wrong signs trigger a retry
// bubble; two correct confirms advance the lesson.
// ============================================================

import type { Lesson } from './types';

export const lesson05OpCycle: Lesson = {
  id: 'op-cycle-basics',
  titleKey: 'tutorial.l5.title',
  descKey: 'tutorial.l5.desc',
  steps: [
    {
      id: 'cycle-signs',
      botDemo: async (api) => {
        // Give the learner time to READ the intro bubble before it auto-flips
        // to the hint bubble. 600ms was too short — text barely appeared.
        await api.wait(3000);
      },
      outcome: (event) => event.kind === 'l5AllSignsCycled',
      hintKey: 'tutorial.l5a.hintCycle',
      botHintKey: 'tutorial.l5a.botIntro',
      celebrateKey: 'tutorial.l5a.celebrate',
    },
    {
      id: 'joker-place',
      botDemo: async (api) => {
        await api.wait(3000);
      },
      outcome: (event) => event.kind === 'l5JokerFlowCompleted',
      hintKey: 'tutorial.l5b.hintTapJoker',
      botHintKey: 'tutorial.l5b.botIntro',
      celebrateKey: 'tutorial.l5b.celebrate',
    },
    {
      id: 'solve-for-op',
      botDemo: async (api) => {
        await api.wait(3000);
      },
      outcome: (event) => event.kind === 'l5OpExercisesDone',
      hintKey: 'tutorial.l5c.hintSolve',
      botHintKey: 'tutorial.l5c.botIntro',
      celebrateKey: 'tutorial.l5c.celebrate',
    },
  ],
};
