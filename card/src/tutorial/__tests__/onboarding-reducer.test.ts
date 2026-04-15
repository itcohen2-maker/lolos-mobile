import {
  createInitialOnboardingState,
  onboardingReducer,
  type OnboardingTile,
} from '../onboardingReducer';

function mkState() {
  const tiles: OnboardingTile[] = [
    { id: 't8', kind: 'target', value: 8 },
    { id: 't9', kind: 'target', value: 9 },
    { id: 't4', kind: 'target', value: 4 },
    { id: 'op-plus', kind: 'operator', value: '+' },
    { id: 'op-minus', kind: 'operator', value: '-' },
    { id: 'flex-x', kind: 'flexible', label: 'x' },
  ];
  return createInitialOnboardingState(tiles);
}

describe('onboardingReducer', () => {
  test('accumulates selected tile values including assigned flexible tile', () => {
    let state = mkState();
    state = onboardingReducer(state, { type: 'SELECT_TILE', tileId: 't8' });
    expect(state.cumulativeSum).toBe(8);

    state = onboardingReducer(state, { type: 'SELECT_TILE', tileId: 'flex-x' });
    expect(state.pendingFlexibleTileId).toBe('flex-x');

    state = onboardingReducer(state, { type: 'ASSIGN_FLEXIBLE_VALUE', tileId: 'flex-x', value: 3 });
    expect(state.cumulativeSum).toBe(11);
  });

  test('generates three source numbers at start of turn', () => {
    const state = onboardingReducer(mkState(), {
      type: 'GENERATE_SOURCES',
      values: [5, 4, 1],
    });
    expect(state.sourceNumbers).toEqual([5, 4, 1]);
    expect(state.generateClicked).toBe(true);
  });

  test('solves two distinct targets and reaches mastery when only two remain', () => {
    let state = mkState();
    state = onboardingReducer(state, { type: 'GENERATE_SOURCES', values: [5, 4, 1] });
    state = onboardingReducer(state, { type: 'SET_ACTIVE_EQUATION', index: 0 });
    state = onboardingReducer(state, { type: 'SET_EQUATION_TARGET', index: 0, targetTileId: 't9' });
    state = onboardingReducer(state, { type: 'TAP_SOURCE_NUMBER', number: 5 });
    state = onboardingReducer(state, { type: 'TAP_SOURCE_NUMBER', number: 4 });
    state = onboardingReducer(state, { type: 'CONFIRM_EQUATION', index: 0 });
    expect(state.remainingTargetIds.includes('t9')).toBe(false);

    state = onboardingReducer(state, { type: 'SET_ACTIVE_EQUATION', index: 1 });
    state = onboardingReducer(state, { type: 'SET_EQUATION_TARGET', index: 1, targetTileId: 't4' });
    state = onboardingReducer(state, { type: 'TAP_SOURCE_NUMBER', number: 6 });
    state = onboardingReducer(state, { type: 'TAP_SOURCE_NUMBER', number: 2 });
    state = onboardingReducer(state, { type: 'TOGGLE_EQUATION_OPERATOR', index: 1 });
    state = onboardingReducer(state, { type: 'CONFIRM_EQUATION', index: 1 });
    expect(state.remainingTargetIds.includes('t4')).toBe(false);
    expect(state.masteryAchieved).toBe(true);
  });
});
