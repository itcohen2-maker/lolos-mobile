// ============================================================
// shared/difficultyStages.ts — שלבי תרגול A–H (מיגרציה מ־C–J ומאותיות ישנות)
// ============================================================

import type { Operation } from './types';

export type DifficultyStageId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface DifficultyStageConfig {
  id: DifficultyStageId;
  rangeMax: 12 | 25;
  enabledOperators: Operation[];
  allowNegativeTargets: boolean;
}

/** ± בטווח 0–12 / 0–25; ×÷ באותם טווחים — בלי שלב «רק חיבור» / «רק חיסור». */
export const DIFFICULTY_STAGE_CONFIG: Record<DifficultyStageId, DifficultyStageConfig> = {
  A: { id: 'A', rangeMax: 12, enabledOperators: ['+', '-'], allowNegativeTargets: false },
  B: { id: 'B', rangeMax: 12, enabledOperators: ['+', '-'], allowNegativeTargets: false },
  C: { id: 'C', rangeMax: 25, enabledOperators: ['+', '-'], allowNegativeTargets: false },
  D: { id: 'D', rangeMax: 25, enabledOperators: ['+', '-'], allowNegativeTargets: false },
  E: { id: 'E', rangeMax: 12, enabledOperators: ['x', '÷'], allowNegativeTargets: false },
  F: { id: 'F', rangeMax: 12, enabledOperators: ['x', '÷'], allowNegativeTargets: false },
  G: { id: 'G', rangeMax: 25, enabledOperators: ['x', '÷'], allowNegativeTargets: false },
  H: { id: 'H', rangeMax: 25, enabledOperators: ['x', '÷'], allowNegativeTargets: false },
};

export const STAGE_SEQUENCE: DifficultyStageId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const NEW_ID_SET = new Set<string>(STAGE_SEQUENCE);

/** מיפוי אותיות ישנות של המוצר (C–J) ל־A–H */
const CJ_TO_NEW: Record<string, DifficultyStageId> = {
  C: 'A',
  D: 'B',
  E: 'C',
  F: 'D',
  G: 'E',
  H: 'F',
  I: 'G',
  J: 'H',
};

/**
 * לפני C–J: ערכי A–H ישנים מהמיגרציה הראשונה → אות ביניים (C–J) → A–H נוכחי.
 * ראו היסטוריה ב־LEGACY_TO_NEW הקודם (מיפוי ל־C/D/E/F).
 */
const LEGACY_LETTER_TO_CJ: Record<string, keyof typeof CJ_TO_NEW> = {
  A: 'C',
  B: 'C',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'E',
  G: 'E',
  H: 'F',
};

export function migrateDifficultyStage(raw: string | undefined | null): DifficultyStageId {
  const u = (raw ?? 'H').toString();
  if (NEW_ID_SET.has(u)) return u as DifficultyStageId;
  if (CJ_TO_NEW[u]) return CJ_TO_NEW[u];
  const bridge = LEGACY_LETTER_TO_CJ[u];
  if (bridge != null && CJ_TO_NEW[bridge]) return CJ_TO_NEW[bridge];
  return 'A';
}
