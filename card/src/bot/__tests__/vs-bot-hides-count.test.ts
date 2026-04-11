// Compile-check for M6.5.
// Runtime verification of visibility happens in M7 manual playthrough.

describe('M6.5 vs-bot hides player count', () => {
  it('StartScreen compiles after M6.5 edit', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../index');
    expect(mod).toBeDefined();
  });
});
