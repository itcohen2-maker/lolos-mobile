// Tests that index.tsx exports all the values and types that src/bot/ depends on.
// Run: cd card && npm test -- src/bot/__tests__/exports.test.ts

// Mocks for native/missing modules that index.tsx imports at module level.
// These are required because jest-expo does not stub all Expo native modules,
// and some peer dependencies are not installed in the test environment.
jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn().mockResolvedValue({ sound: { playAsync: jest.fn(), unloadAsync: jest.fn() } }) },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
  setButtonStyleAsync: jest.fn().mockResolvedValue(undefined),
  setBehaviorAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@expo-google-fonts/fredoka', () => ({
  useFonts: jest.fn().mockReturnValue([true, null]),
  Fredoka_700Bold: 'Fredoka_700Bold',
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

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
