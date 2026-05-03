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
    l11Config: () => null,
  };
  return { api, scrollCalls, pulseCalls };
}

describe('lesson-05 step 2 (joker-place) botDemo', () => {
  it('scrolls to the middle of a 5-card fan (Slinda at index 2)', async () => {
    const { api, scrollCalls, pulseCalls } = makeRecordingApi(5);
    const step = lesson05OpCycle.steps[1];
    await step.botDemo(api);

    // Two scroll calls: an instant snap (durationMs:0) to place Slinda at
    // the visual centre before the learner sees the fan, then an animated
    // "settle" a moment later that doubles as a visual cue.
    expect(scrollCalls.map((c) => c.idx)).toEqual([2, 2]);
    expect(pulseCalls.map((c) => c.idx)).toEqual([2]);
  });

  it('still lands on a valid index for a 4-card fan', async () => {
    // Slinda's rigged index (2) is valid for any fan of length ≥ 3.
    const { api, scrollCalls } = makeRecordingApi(4);
    const step = lesson05OpCycle.steps[1];
    await step.botDemo(api);
    expect(scrollCalls.map((c) => c.idx)).toEqual([2, 2]);
  });
});

describe('lesson-05 step 1 (place-op) outcome', () => {
  it('advances only when the plus card is placed in the first operator slot', () => {
    const step = lesson05OpCycle.steps[0];
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: '+', position: 0 })).toBe(true);
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: '+', position: 1 })).toBe(false);
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: '-', position: 0 })).toBe(false);
  });
});
