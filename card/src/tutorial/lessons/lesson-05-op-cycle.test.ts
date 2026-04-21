import type { DemoApi, ScrollOpts } from '../BotDemonstrator';
import { lesson05OpCycle } from './lesson-05-op-cycle';

type ScrollCall = { idx: number; opts: ScrollOpts };
type PulseCall = { idx: number; durationMs: number | undefined };

function makeRecordingApi(fanLength: number): {
  api: DemoApi;
  scrollCalls: ScrollCall[];
  pulseCalls: PulseCall[];
} {
  const scrollCalls: ScrollCall[] = [];
  const pulseCalls: PulseCall[] = [];
  const api: DemoApi = {
    async scrollFanTo(idx, opts = {}) { scrollCalls.push({ idx, opts }); },
    async pulseCard(idx, durationMs) { pulseCalls.push({ idx, durationMs }); },
    async pulseDiceBtn() {},
    async eqPickDice() {},
    async eqSetOp() {},
    async eqConfirm() {},
    async eqReset() {},
    async stageCardByValue() {},
    l4Config: () => null,
    async wait() {},
    fanLength: () => fanLength,
    async openResultsChip() {},
    async tapMiniResult() {},
    l6CopyConfig: () => null,
  };
  return { api, scrollCalls, pulseCalls };
}

describe('lesson-05 step 2 (joker-place) botDemo', () => {
  it('scrolls to the middle of a 5-card fan (Slinda at index 2)', async () => {
    const { api, scrollCalls, pulseCalls } = makeRecordingApi(5);
    const step = lesson05OpCycle.steps[1];
    await step.botDemo(api);

    expect(scrollCalls.map((c) => c.idx)).toEqual([2]);
    expect(pulseCalls.map((c) => c.idx)).toEqual([2]);
  });

  it('still lands on a valid index for a 4-card fan', async () => {
    // floor(4/2) = 2 → valid (indices 0..3).
    const { api, scrollCalls } = makeRecordingApi(4);
    const step = lesson05OpCycle.steps[1];
    await step.botDemo(api);
    expect(scrollCalls.map((c) => c.idx)).toEqual([2]);
  });
});
