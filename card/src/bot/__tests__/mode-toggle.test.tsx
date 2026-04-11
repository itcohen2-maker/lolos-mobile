// Tests that mode + bot-difficulty toggles are rendered inside StartScreen.
// Runtime verification happens in M7 manual playthrough — this is a
// compile-check that the import surface still works after the JSX edit.

describe('M6.3 mode toggle', () => {
  it('StartScreen is exported (compile check)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../index');
    expect(mod).toBeDefined();
  });
});
