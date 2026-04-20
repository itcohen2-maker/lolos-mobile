// ============================================================
// lesson-01-fan.ts — First watch-and-mimic lesson: the fan.
// Bot sweeps the fan right to the end, then left to the end,
// then settles on the middle card so cards are visible on both
// sides. User must then do something equivalent (any scroll,
// any tap) to pass the step.
// ============================================================

import type { Lesson } from './types';

const SWEEP_MS = 900;
const PAUSE_MS = 400;
const SETTLE_MS = 700;

export const lesson01Fan: Lesson = {
  id: 'fan-basics',
  titleKey: 'tutorial.l1.title',
  descKey: 'tutorial.l1.desc',
  steps: [
    {
      id: 'scroll-fan',
      botDemo: async (api) => {
        const n = api.fanLength();
        if (n <= 1) return;
        const last = n - 1;
        const mid = Math.floor(last / 2);
        await api.scrollFanTo(last, { durationMs: SWEEP_MS, easing: 'sweep' });
        await api.wait(PAUSE_MS);
        await api.scrollFanTo(0, { durationMs: SWEEP_MS, easing: 'sweep' });
        await api.wait(PAUSE_MS);
        await api.scrollFanTo(mid, { durationMs: SETTLE_MS, easing: 'settle' });
      },
      outcome: (event) => event.kind === 'fanScrolled',
      highlight: { target: 'fan', shape: 'arrow' },
      hintKey: 'tutorial.l1.hintScroll',
      botHintKey: 'tutorial.l1.botScroll',
    },
  ],
};
