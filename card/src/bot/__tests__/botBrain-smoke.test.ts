// Smoke test that botBrain.ts compiles and decideBotAction is callable.
// Full behavioral tests are in M3 (botBrain.test.ts).

import { decideBotAction } from '../botBrain';
import { initialState } from '../../../index';
import type { BotAction } from '../types';

describe('botBrain smoke', () => {
  it('decideBotAction is callable', () => {
    expect(typeof decideBotAction).toBe('function');
  });

  it('decideBotAction returns null in setup phase', () => {
    const result = decideBotAction(initialState, 'easy');
    expect(result).toBeNull();
  });

  it('decideBotAction return type is BotAction | null', () => {
    // Compile-time type check via variable assignment
    const result: BotAction | null = decideBotAction(initialState, 'hard');
    expect(result).toBeNull();
  });
});
