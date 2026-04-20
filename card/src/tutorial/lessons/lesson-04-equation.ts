// ============================================================
// lesson-04-equation.ts — Fourth watch-and-mimic lesson:
// build a simple `+` exercise from two dice and play the
// matching card from the hand.
//
// The lesson runs on the real EquationBuilder + PlayerHand.
// Pre-rigged: dice [2, 3, 7] and hand of cards 1..5; the bot
// picks dice 2 + 3 → 5 and the matching card is "5". Die "7"
// stays unused so the learner sees there were options.
// ============================================================

import { tutorialBus } from '../tutorialBus';
import type { Lesson } from './types';

// Cards in lesson-4 are rigged with ids `tut-l4-card-{value}-{timestamp}`
// (user hand) and `tut-l4-bot-card-{value}-{timestamp}` (bot hand). The
// tutorial runs in pass-and-play with currentPlayerIndex=0 (bot), so the
// fan actually shows bot cards during await-mimic — the regex must accept
// both formats or the learner's correct tap gets rejected.
function cardIdValue(cardId: string): number | null {
  const m = /^tut-l4-(?:bot-)?card-(\d+)(?:-|$)/.exec(cardId);
  return m ? parseInt(m[1], 10) : null;
}

export const lesson04Equation: Lesson = {
  id: 'equation-basics',
  titleKey: 'tutorial.l4.title',
  descKey: 'tutorial.l4.desc',
  steps: [
    {
      id: 'play-card',
      // Step 1 — bot performs the full exercise (build + confirm + pick).
      // The learner must tap the CORRECT target card to advance; wrong
      // taps are rejected so the learner can't breeze past a mistake.
      botDemo: async (api) => {
        const cfg = api.l4Config();
        const pickA = cfg?.pickA ?? 0;
        const pickB = cfg?.pickB ?? 1;
        const target = cfg?.target ?? 5;
        const hand = cfg?.hand ?? [1, 2, 3, 4, 5];
        const targetIdx = hand.indexOf(target);
        await api.wait(2800);
        await api.eqPickDice(pickA);
        await api.wait(200);
        await api.eqSetOp(1, '+');
        await api.wait(200);
        await api.eqPickDice(pickB);
        await api.wait(600);
        await api.eqConfirm();
        await api.wait(2400);
        if (targetIdx >= 0) {
          await api.scrollFanTo(targetIdx, { durationMs: 600, easing: 'settle' });
          await api.wait(300);
          await api.pulseCard(targetIdx, 6000);
        }
        await api.stageCardByValue(target);
      },
      outcome: (event) => {
        // Check against the ACTUAL equation result the learner confirmed
        // (stored in tutorialBus.lastEquationResult), not just any validSum.
        if (event.kind !== 'cardTapped') return false;
        const eqResult = tutorialBus.getLastEquationResult();
        if (eqResult === null) return false;
        const v = cardIdValue(event.cardId);
        return v === eqResult;
      },
      hintKey: 'tutorial.l4.hintTap',
      botHintKey: 'tutorial.l4.botBuild',
      celebrateKey: 'tutorial.l4.celebrate',
    },
    {
      id: 'fill-missing-die',
      // Step 2 — partial equation (first die + op pre-filled). The target
      // card is scrolled to the center of the fan as a hint. The learner
      // must tap the CORRECT missing die (pickB). Wrong picks are rejected.
      botDemo: async (api) => {
        const cfg = api.l4Config();
        const pickA = cfg?.pickA ?? 0;
        const target = cfg?.target ?? 5;
        const hand = cfg?.hand ?? [1, 2, 3, 4, 5];
        const targetIdx = hand.indexOf(target);
        await api.eqReset();
        await api.wait(500);
        await api.eqPickDice(pickA);
        await api.wait(200);
        await api.eqSetOp(1, '+');
        await api.wait(200);
        if (targetIdx >= 0) {
          await api.scrollFanTo(targetIdx, { durationMs: 500, easing: 'settle' });
        }
      },
      outcome: (event) => {
        // Check against the ACTUAL equation result the learner confirmed.
        if (event.kind !== 'cardTapped') return false;
        const eqResult = tutorialBus.getLastEquationResult();
        if (eqResult === null) return false;
        const v = cardIdValue(event.cardId);
        return v === eqResult;
      },
      hintKey: 'tutorial.l4b.hintFillDie',
      botHintKey: 'tutorial.l4b.botFillDie',
      celebrateKey: 'tutorial.l4b.celebrate',
    },
    {
      id: 'full-build',
      // Step 3 — guided full build. Unlike steps 1-2, the learner drives the
      // whole flow: add 2 numbers + an op, press "אשר את התרגיל", pick cards
      // that match the result, press "בחרתי". InteractiveTutorialScreen tracks
      // the sub-phase (build → confirm → pick → play) and draws an arrow at
      // the relevant button. The step advances when `userPlayedCards` fires —
      // the learner hit "בחרתי", completing the full round.
      botDemo: async (api) => {
        const cfg = api.l4Config();
        const target = cfg?.target ?? 5;
        const hand = cfg?.hand ?? [1, 2, 3, 4, 5];
        const targetIdx = hand.indexOf(target);
        await api.eqReset();
        // Longer pause so "עכשיו תורכם" bubble stays visible long enough
        // for the learner to read it before the phase switches.
        await api.wait(2000);
        if (targetIdx >= 0) {
          await api.scrollFanTo(targetIdx, { durationMs: 500, easing: 'settle' });
        }
      },
      outcome: (event) => event.kind === 'userPlayedCards',
      hintKey: 'tutorial.l4c.hintFull',
      botHintKey: 'tutorial.l4c.botFull',
      celebrateKey: 'tutorial.l4c.celebrate',
    },
  ],
};
