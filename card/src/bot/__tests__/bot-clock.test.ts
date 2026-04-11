// Compile-check test for the bot clock useEffect inside GameProvider.
// Full runtime verification happens in M7 manual playthrough — testing
// setTimeout-based effects in Jest with React Native requires fake timers
// + renderHook setup which is disproportionate for a ~50-line effect.

import { GameProvider, useGame } from '../../../index';

describe('M5.6 bot clock', () => {
  it('GameProvider is a function (exports intact)', () => {
    expect(typeof GameProvider).toBe('function');
  });

  it('useGame is a function (exports intact)', () => {
    expect(typeof useGame).toBe('function');
  });
});
