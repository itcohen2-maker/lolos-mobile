// Tests that index.tsx exports all the values and types that src/bot/ depends on.
// Run: cd card && npm test -- src/bot/__tests__/exports.test.ts
//
// Native module mocks are provided by jest.setup.ts (referenced from jest.config.js
// via setupFilesAfterEach). Do NOT duplicate them here.

import {
  gameReducer,
  initialState,
  validateFractionPlay,
  validateIdenticalPlay,
  validateStagedCards,
  fractionDenominator,
} from '../../../index';

import type {
  GameState,
  GameAction,
  Card,
  Player,
  Operation,
  Fraction,
  CardType,
  GamePhase,
  DiceResult,
  EquationOption,
  EquationCommitPayload,
} from '../../../index';

describe('index.tsx exports for src/bot/', () => {
  it('exports gameReducer as a function', () => {
    expect(typeof gameReducer).toBe('function');
  });

  it('exports initialState as an object', () => {
    expect(typeof initialState).toBe('object');
    expect(initialState).not.toBeNull();
  });

  it('exports validateFractionPlay as a function', () => {
    expect(typeof validateFractionPlay).toBe('function');
  });

  it('exports validateIdenticalPlay as a function', () => {
    expect(typeof validateIdenticalPlay).toBe('function');
  });

  it('exports validateStagedCards as a function', () => {
    expect(typeof validateStagedCards).toBe('function');
  });

  it('exports fractionDenominator as a function', () => {
    expect(typeof fractionDenominator).toBe('function');
  });

  it('initialState has phase setup', () => {
    expect(initialState.phase).toBe('setup');
  });
});
