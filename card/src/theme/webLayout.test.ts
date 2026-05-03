import { getWebContentWidth, getWebGameLayout } from './webLayout';

describe('getWebContentWidth', () => {
  it('caps wide viewports to the requested max width', () => {
    expect(getWebContentWidth(1600, { maxWidth: 1100, sidePadding: 40 })).toBe(1100);
  });

  it('preserves readable width on narrow viewports', () => {
    expect(getWebContentWidth(768, { maxWidth: 1100, sidePadding: 40 })).toBe(728);
  });
});

describe('getWebGameLayout', () => {
  it.each([
    [{ width: 1366, height: 768 }, { tableHeight: 150, tableTop: 100, handBottom: 46, fanCardHeight: 115, fanCardWidth: 82, fanViewportHeight: 140 }],
    [{ width: 1440, height: 900 }, { tableHeight: 162, tableTop: 117, handBottom: 54, fanCardHeight: 124, fanCardWidth: 88, fanViewportHeight: 151 }],
    [{ width: 1920, height: 1080 }, { tableHeight: 188, tableTop: 132, handBottom: 65, fanCardHeight: 124, fanCardWidth: 88, fanViewportHeight: 151 }],
    [{ width: 768, height: 1024 }, { tableHeight: 184, tableTop: 132, handBottom: 61, fanCardHeight: 124, fanCardWidth: 88, fanViewportHeight: 151 }],
  ])('returns stable clamped layout for %o', (viewport, expected) => {
    const layout = getWebGameLayout(viewport);

    expect(layout.tableHeight).toBe(expected.tableHeight);
    expect(layout.tableTop).toBe(expected.tableTop);
    expect(layout.handBottom).toBe(expected.handBottom);
    expect(layout.fanCardHeight).toBe(expected.fanCardHeight);
    expect(layout.fanCardWidth).toBe(expected.fanCardWidth);
    expect(layout.fanViewportHeight).toBe(expected.fanViewportHeight);
    expect(layout.handStripHeight).toBe(layout.fanViewportHeight + 24);
    expect(layout.timerTop).toBe(layout.tableTop + layout.tableHeight + 32);
  });

  it('keeps the table and hand within readable bounds on short viewports', () => {
    const layout = getWebGameLayout({ width: 900, height: 640 });

    expect(layout.tableHeight).toBeGreaterThanOrEqual(150);
    expect(layout.tableHeight).toBeLessThanOrEqual(188);
    expect(layout.handBottom).toBeGreaterThanOrEqual(40);
    expect(layout.goldActionButtonTop).toBeGreaterThanOrEqual(96);
    expect(layout.tableWidth).toBeLessThanOrEqual(560);
  });
});
