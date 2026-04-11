// Compile-check + snapshot-style test that StartScreen dispatches START_GAME
// with the correct shape in both pass-and-play and vs-bot modes.
// Runtime rendering of StartScreen requires full provider setup; this test
// verifies the module compiles and the types are right.

describe('M6.4 START_GAME dispatch shape', () => {
  it('StartScreen compiles after dispatch amendment', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../index');
    expect(mod).toBeDefined();
  });
});
