// ============================================================
// lesson-05-op-cycle.ts — Fifth lesson: operation signs.
//
// Runs on the real game UI (EquationBuilder + hand strip).
//
// Step 5.1 (place-op): the equation is set up as a tiny
// exercise — `4 ? 3 = 7`. The first two number slots are
// pre-filled, the sign between them is empty, and the result
// box shows the target (7). The learner's job is to pick the
// `+` operation card from the fan and drop it on the empty
// sign slot to complete `4 + 3 = 7`. Wrong ops don't advance
// the step (the learner sees the mismatched result and can
// remove + retry). No cycle-on-tap.
// Step 5.2 (joker-place): mirrors the 5.1 exercise exactly —
// dice 4,3,9, d1=4 and d2=3 prefilled, target 7 in the result box,
// sign slot empty — but the player's hand swaps the `+` card for
// Slinda sitting in the centre of the fan. The learner taps Slinda
// → picks a sign in the modal → places her on the empty sign slot.
// The mirrored layout makes the teaching point concrete: same
// puzzle as 5.1, different card.
// ============================================================

import type { Lesson } from './types';

export const lesson05OpCycle: Lesson = {
  id: 'op-cycle-basics',
  titleKey: 'tutorial.l5.title',
  descKey: 'tutorial.l5.desc',
  steps: [
    {
      id: 'place-op',
      // The host (InteractiveTutorialScreen) rigs fresh dice + a four-card
      // operator hand on entry, pre-fills the three dice slots, and sets
      // both operator slots to `+` so the equation reads as fully filled.
      // The bot-demo phase is a short pause so the intro bubble has time
      // to read before it flips to the hint.
      botDemo: async (api) => {
        await api.wait(2200);
      },
      outcome: (event) => event.kind === 'l5OperatorPlaced' && event.op === '+',
      hintKey: 'tutorial.l5a.hintChooseCard',
      botHintKey: 'tutorial.l5a.botIntro',
      celebrateKey: 'tutorial.l5a.celebrate',
    },
    {
      id: 'joker-place',
      // Slinda is rigged in the centre of the L5 hand (index 2 of 5 — see
      // InteractiveTutorialScreen's L5.2 rigging block). Scroll there and
      // pulse so the learner's eye lands on her before the bubble prompts
      // them to tap. Using floor(fanLength/2) keeps the pointer correct
      // even if the hand size changes.
      botDemo: async (api) => {
        const jokerIdx = Math.floor(api.fanLength() / 2);
        await api.wait(600);
        await api.scrollFanTo(jokerIdx, { durationMs: 700, easing: 'settle' });
        await api.wait(250);
        await api.pulseCard(jokerIdx, 2200);
      },
      outcome: (event) => event.kind === 'l5JokerFlowCompleted',
      hintKey: 'tutorial.l5b.hintTapJoker',
      botHintKey: 'tutorial.l5b.botIntro',
      celebrateKey: 'tutorial.l5b.celebrate',
    },
  ],
};
