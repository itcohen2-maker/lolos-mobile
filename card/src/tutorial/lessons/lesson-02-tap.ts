// ============================================================
// lesson-02-tap.ts — Second watch-and-mimic lesson: tap a card.
// Bot pulses a card so the learner sees what "picking" looks
// like, then the learner picks any card to advance.
// ============================================================

import type { Lesson } from './types';

const PULSE_MS = 750;

export const lesson02Tap: Lesson = {
  id: 'tap-card',
  titleKey: 'tutorial.l2.title',
  descKey: 'tutorial.l2.desc',
  steps: [
    {
      id: 'tap-card',
      botDemo: async (api) => {
        const n = api.fanLength();
        if (n <= 0) return;
        // Move to a clearly central card and pulse it so the choice is
        // unambiguous. floor((n-1)/2) is the same "middle" used in lesson 1.
        const mid = Math.floor((n - 1) / 2);
        await api.scrollFanTo(mid, { durationMs: 500, easing: 'settle' });
        await api.wait(200);
        await api.pulseCard(mid, PULSE_MS);
      },
      outcome: (event) => event.kind === 'cardTapped',
      highlight: { target: 'fan', shape: 'ring' },
      hintKey: 'tutorial.l2.hintTap',
      botHintKey: 'tutorial.l2.botTap',
      celebrateKey: 'tutorial.l2.celebrate',
    },
  ],
};
