export type ViewportSize = {
  width: number;
  height: number;
};

export type ContentWidthOptions = {
  maxWidth?: number;
  sidePadding?: number;
};

export type WebGameLayout = {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  tableWidth: number;
  tableHeight: number;
  tableTop: number;
  tableBottomPadding: number;
  handBottom: number;
  fanCardHeight: number;
  fanCardWidth: number;
  fanViewportHeight: number;
  handStripAboveFan: number;
  handStripHeight: number;
  handZoneTop: number;
  miniResultsBottom: number;
  resultsTop: number;
  resultsRight: number;
  parensTop: number;
  timerTop: number;
  goldActionButtonTop: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getWebContentWidth(
  viewportWidth: number,
  options: ContentWidthOptions = {},
): number {
  const maxWidth = options.maxWidth ?? 1180;
  const sidePadding = options.sidePadding ?? 32;
  const safeWidth = Math.max(320, Math.round(viewportWidth || 0));
  return Math.min(maxWidth, Math.max(320, safeWidth - sidePadding));
}

export function getWebGameLayout(viewport: ViewportSize): WebGameLayout {
  const viewportWidth = Math.max(320, Math.round(viewport.width || 0));
  const viewportHeight = Math.max(568, Math.round(viewport.height || 0));
  const contentWidth = getWebContentWidth(viewportWidth, { maxWidth: 1180, sidePadding: 32 });
  const tableHeight = clamp(Math.round(viewportHeight * 0.18), 150, 188);
  const tableTop = clamp(Math.round(viewportHeight * 0.13), 92, 132);
  const handBottom = clamp(Math.round(viewportHeight * 0.06), 40, 72);
  const fanCardHeight = clamp(Math.round(viewportHeight * 0.15), 104, 124);
  const fanCardWidth = Math.round(fanCardHeight * 0.71);
  const fanViewportHeight = Math.round(fanCardHeight * 1.22);
  const handStripAboveFan = 24;
  const handStripHeight = fanViewportHeight + handStripAboveFan;
  const handZoneTop = handBottom + handStripHeight;
  const miniResultsBottom = handZoneTop - 10;
  const tableWidth = clamp(Math.round(contentWidth * 0.44), 300, 560);
  const tableBottomPadding = Math.max(56, Math.round(tableHeight * 0.4));
  const resultsTop = Math.max(68, tableTop - Math.round(tableHeight * 0.18));
  const resultsRight = Math.max(20, Math.round((viewportWidth - tableWidth) / 2) - 4);
  const parensTop = Math.max(92, tableTop - Math.round(tableHeight * 0.18));
  const timerTop = tableTop + tableHeight + 32;
  const maxButtonTop = viewportHeight - (handBottom + handStripHeight + 132);
  const preferredButtonTop = tableTop + tableHeight + tableBottomPadding + 8;
  const goldActionButtonTop = clamp(preferredButtonTop, 96, Math.max(96, maxButtonTop));

  return {
    viewportWidth,
    viewportHeight,
    contentWidth,
    tableWidth,
    tableHeight,
    tableTop,
    tableBottomPadding,
    handBottom,
    fanCardHeight,
    fanCardWidth,
    fanViewportHeight,
    handStripAboveFan,
    handStripHeight,
    handZoneTop,
    miniResultsBottom,
    resultsTop,
    resultsRight,
    parensTop,
    timerTop,
    goldActionButtonTop,
  };
}
