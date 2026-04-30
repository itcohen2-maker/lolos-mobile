import { resolveGameTableSurface } from './gameTableSurface';

describe('resolveGameTableSurface', () => {
  it('uses active table skin image when equipped', () => {
    const fallback = { test: 'fallback' };
    const equipped = { test: 'skin' };

    const result = resolveGameTableSurface(equipped, fallback);

    expect(result).toBe(equipped);
  });

  it('falls back to default game table when no skin equipped', () => {
    const fallback = { test: 'fallback' };

    const result = resolveGameTableSurface(null, fallback);

    expect(result).toBe(fallback);
  });
});
