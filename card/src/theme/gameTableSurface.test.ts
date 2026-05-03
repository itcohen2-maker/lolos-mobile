import { resolveGameTableSurface } from './gameTableSurface';

describe('resolveGameTableSurface', () => {
  it('uses active table skin image when equipped', () => {
    const fallback = { test: 'fallback' };
    const equipped = { image: { test: 'skin' } };

    const result = resolveGameTableSurface(equipped, fallback);

    expect(result).toEqual({ source: equipped.image, resizeMode: 'contain' });
  });

  it('falls back to default game table when no skin equipped', () => {
    const fallback = { test: 'fallback' };

    const result = resolveGameTableSurface(null, fallback);

    expect(result).toEqual({ source: fallback, resizeMode: 'stretch' });
  });

  it('uses contain mode for the web fallback table', () => {
    const fallback = { test: 'fallback' };

    const result = resolveGameTableSurface(null, fallback, { platform: 'web' });

    expect(result).toEqual({ source: fallback, resizeMode: 'contain' });
  });
});
