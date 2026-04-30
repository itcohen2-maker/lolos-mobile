export type TileKind = 'target' | 'operator' | 'flexible';

export interface OnboardingTile {
  id: string;
  kind: TileKind;
  value?: number | '+' | '-';
  label?: string;
}

interface EquationDraft {
  targetTileId: string | null;
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
}

export interface OnboardingState {
  ribbonTiles: OnboardingTile[];
  hasDemoScrolled: boolean;
  hasUserScrolled: boolean;
  selectedTileIds: string[];
  flexibleValues: Record<string, number>;
  pendingFlexibleTileId: string | null;
  cumulativeSum: number;
  generateClicked: boolean;
  sourceNumbers: number[];
  activeEquationIndex: 0 | 1;
  equations: [EquationDraft, EquationDraft];
  remainingTargetIds: string[];
  masteryAchieved: boolean;
  timedMasteryEnabled: boolean;
}

export type OnboardingAction =
  | { type: 'DEMO_SCROLL_DONE' }
  | { type: 'USER_SCROLLED' }
  | { type: 'SELECT_TILE'; tileId: string }
  | { type: 'ASSIGN_FLEXIBLE_VALUE'; tileId: string; value: number }
  | { type: 'GENERATE_SOURCES'; values: number[] }
  | { type: 'SET_ACTIVE_EQUATION'; index: 0 | 1 }
  | { type: 'SET_EQUATION_TARGET'; index: 0 | 1; targetTileId: string }
  | { type: 'TAP_SOURCE_NUMBER'; number: number }
  | { type: 'TOGGLE_EQUATION_OPERATOR'; index: 0 | 1 }
  | { type: 'CONFIRM_EQUATION'; index: 0 | 1 }
  | { type: 'TOGGLE_TIMED_MASTERY'; enabled: boolean };

const defaultEquation = (): EquationDraft => ({
  targetTileId: null,
  slots: [null, null],
  operator: '+',
  result: null,
});

const calcSum = (state: Pick<OnboardingState, 'selectedTileIds' | 'ribbonTiles' | 'flexibleValues'>): number => {
  return state.selectedTileIds.reduce((sum, tileId) => {
    const tile = state.ribbonTiles.find((entry) => entry.id === tileId);
    if (!tile) return sum;
    if (tile.kind === 'target' && typeof tile.value === 'number') return sum + tile.value;
    if (tile.kind === 'flexible') {
      const v = state.flexibleValues[tile.id];
      return sum + (Number.isFinite(v) ? v : 0);
    }
    return sum;
  }, 0);
};

const evalEquation = (eq: EquationDraft): number | null => {
  const [a, b] = eq.slots;
  if (a == null || b == null) return null;
  return eq.operator === '+' ? a + b : a - b;
};

export const createInitialOnboardingState = (tiles: OnboardingTile[]): OnboardingState => {
  const targetIds = tiles.filter((t) => t.kind === 'target').map((t) => t.id);
  return {
    ribbonTiles: tiles,
    hasDemoScrolled: false,
    hasUserScrolled: false,
    selectedTileIds: [],
    flexibleValues: {},
    pendingFlexibleTileId: null,
    cumulativeSum: 0,
    generateClicked: false,
    sourceNumbers: [],
    activeEquationIndex: 0,
    equations: [defaultEquation(), defaultEquation()],
    remainingTargetIds: targetIds,
    masteryAchieved: targetIds.length <= 2,
    timedMasteryEnabled: false,
  };
};

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'DEMO_SCROLL_DONE':
      return { ...state, hasDemoScrolled: true };
    case 'USER_SCROLLED':
      return { ...state, hasUserScrolled: true };
    case 'SELECT_TILE': {
      const tile = state.ribbonTiles.find((entry) => entry.id === action.tileId);
      if (!tile) return state;
      const selectedTileIds = state.selectedTileIds.includes(action.tileId)
        ? state.selectedTileIds.filter((id) => id !== action.tileId)
        : [...state.selectedTileIds, action.tileId];
      const next = { ...state, selectedTileIds };
      return {
        ...next,
        pendingFlexibleTileId: tile.kind === 'flexible' ? tile.id : state.pendingFlexibleTileId,
        cumulativeSum: calcSum(next),
      };
    }
    case 'ASSIGN_FLEXIBLE_VALUE': {
      const flexibleValues = { ...state.flexibleValues, [action.tileId]: action.value };
      const next = { ...state, flexibleValues, pendingFlexibleTileId: null };
      return { ...next, cumulativeSum: calcSum(next) };
    }
    case 'GENERATE_SOURCES':
      return { ...state, generateClicked: true, sourceNumbers: action.values };
    case 'SET_ACTIVE_EQUATION':
      return { ...state, activeEquationIndex: action.index };
    case 'SET_EQUATION_TARGET': {
      const equations = [...state.equations] as [EquationDraft, EquationDraft];
      equations[action.index] = { ...equations[action.index], targetTileId: action.targetTileId };
      return { ...state, equations };
    }
    case 'TAP_SOURCE_NUMBER': {
      const eqIndex = state.activeEquationIndex;
      const equations = [...state.equations] as [EquationDraft, EquationDraft];
      const eq = equations[eqIndex];
      const slots: [number | null, number | null] = [...eq.slots];
      const firstEmpty = slots.findIndex((x) => x == null);
      if (firstEmpty === -1) return state;
      slots[firstEmpty as 0 | 1] = action.number;
      const nextEq: EquationDraft = { ...eq, slots };
      nextEq.result = evalEquation(nextEq);
      equations[eqIndex] = nextEq;
      return { ...state, equations };
    }
    case 'TOGGLE_EQUATION_OPERATOR': {
      const equations = [...state.equations] as [EquationDraft, EquationDraft];
      const eq = equations[action.index];
      const operator = eq.operator === '+' ? '-' : '+';
      const nextEq: EquationDraft = { ...eq, operator };
      nextEq.result = evalEquation(nextEq);
      equations[action.index] = nextEq;
      return { ...state, equations };
    }
    case 'CONFIRM_EQUATION': {
      const eq = state.equations[action.index];
      if (!eq.targetTileId || eq.result == null) return state;
      const targetTile = state.ribbonTiles.find((entry) => entry.id === eq.targetTileId);
      if (!targetTile || typeof targetTile.value !== 'number') return state;
      if (eq.result !== targetTile.value) return state;

      const remainingTargetIds = state.remainingTargetIds.filter((id) => id !== eq.targetTileId);
      return {
        ...state,
        remainingTargetIds,
        masteryAchieved: remainingTargetIds.length <= 2,
      };
    }
    case 'TOGGLE_TIMED_MASTERY':
      return { ...state, timedMasteryEnabled: action.enabled };
    default:
      return state;
  }
}
