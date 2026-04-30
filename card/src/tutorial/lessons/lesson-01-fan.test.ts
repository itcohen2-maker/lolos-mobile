import type { DemoApi, ScrollOpts } from '../BotDemonstrator';
import { lesson01Fan } from './lesson-01-fan';

type ScrollCall = { idx: number; opts: ScrollOpts };

function makeRecordingApi(fanLength: number): {
  api: DemoApi;
  scrollCalls: ScrollCall[];
  waitCalls: number[];
} {
  const scrollCalls: ScrollCall[] = [];
  const waitCalls: number[] = [];
  const api: DemoApi = {
    async scrollFanTo(idx, opts = {}) {
      scrollCalls.push({ idx, opts });
    },
    async pulseCard() {},
    async pulseDiceBtn() {},
    async eqPickDice() {},
    async eqSetOp() {},
    async eqConfirm() {},
    async eqReset() {},
    async stageCardByValue() {},
    l4Config: () => null,
    async wait(ms) {
      waitCalls.push(ms);
    },
    fanLength: () => fanLength,
    async openResultsChip() {},
    async tapMiniResult() {},
    l6CopyConfig: () => null,
    l11Config: () => null,
  };
  return { api, scrollCalls, waitCalls };
}

describe('lesson-01-fan botDemo — right → left → center sweep', () => {
  it('sweeps to last, then 0, then middle for a 5-card hand', async () => {
    const { api, scrollCalls, waitCalls } = makeRecordingApi(5);
    const [step] = lesson01Fan.steps;
    await step.botDemo(api);

    expect(scrollCalls.map((c) => c.idx)).toEqual([4, 0, 2]);
    expect(scrollCalls[0].opts.easing).toBe('sweep');
    expect(scrollCalls[1].opts.easing).toBe('sweep');
    expect(scrollCalls[2].opts.easing).toBe('settle');
    expect(waitCalls.length).toBe(2);
    expect(waitCalls[0]).toBeGreaterThan(0);
    expect(waitCalls[1]).toBeGreaterThan(0);
  });

  it('computes middle as floor((n-1)/2) for an even-length hand', async () => {
    const { api, scrollCalls } = makeRecordingApi(6);
    const [step] = lesson01Fan.steps;
    await step.botDemo(api);

    // 6 cards, indices 0..5, last = 5, mid = floor(5/2) = 2.
    expect(scrollCalls.map((c) => c.idx)).toEqual([5, 0, 2]);
  });

  it('no-ops when the hand has one card or fewer', async () => {
    const [step] = lesson01Fan.steps;
    for (const len of [0, 1]) {
      const { api, scrollCalls, waitCalls } = makeRecordingApi(len);
      await step.botDemo(api);
      expect(scrollCalls).toEqual([]);
      expect(waitCalls).toEqual([]);
    }
  });
});
