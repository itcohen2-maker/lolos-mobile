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
      outcome: (event) =>
        event.kind === 'l5OperatorPlaced' &&
        event.op === '+' &&
        event.position === 0,
      hintKey: 'tutorial.l5a.hintChooseCard',
      botHintKey: 'tutorial.l5a.botIntro',
      celebrateKey: 'tutorial.l5a.celebrate',
    },
    {
      id: 'joker-place',
      // Slinda is rigged at index 2 (centre of the 5-card L5.2 hand — see
      // InteractiveTutorialScreen's L5.2 rigging block). We hardcode 2
      // rather than floor(fanLength/2) because fanLength may still report
      // 0 at the moment botDemo runs (the fan hasn't re-rendered the new
      // hand yet), which would scroll to index 0 instead of Slinda.
      botDemo: async (api) => {
        const jokerIdx = 2;
        await api.scrollFanTo(jokerIdx, { durationMs: 0 });
        await api.wait(600);
        await api.scrollFanTo(jokerIdx, { durationMs: 700, easing: 'settle' });
        await api.wait(250);
        await api.pulseCard(jokerIdx, 2200);
      },
      outcome: (event) => event.kind === 'l5JokerFlowCompleted' && event.op === '+',
      hintKey: 'tutorial.l5b.hintTapJoker',
      botHintKey: 'tutorial.l5b.botIntro',
      celebrateKey: 'tutorial.l5b.celebrate',
    },
    {
      id: 'important-tip',
      botDemo: async (api) => {
        await api.wait(400);
      },
      outcome: (event) => event.kind === 'l3TipAck',
      hintKey: 'tutorial.l3.tipCta',
      botHintKey: 'tutorial.l3.tipBody',
    },
  ],
};
