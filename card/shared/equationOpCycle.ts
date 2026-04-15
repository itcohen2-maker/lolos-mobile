// ============================================================
// shared/equationOpCycle.ts — סדר מחזור אופרטורים בממשק התרגיל
// מסונכן עם enabledOperators (שלבי A–H)
// ============================================================

import type { Operation } from './types';

const OP_ORDER: Operation[] = ['+', '-', 'x', '÷'];

export function normalizeOperationToken(op: string | null | undefined): Operation | null {
  if (op == null) return null;
  if (op === '*' || op === '×') return 'x';
  if (op === '/') return '÷';
  if (op === '+' || op === '-' || op === 'x' || op === '÷') return op;
  return null;
}

export function operationToDisplayOp(op: Operation): string {
  return op === 'x' ? '×' : op;
}

/** מחרוזת תצוגה מהמחזור (×) → טוקן לוגי ל־applyOperation / evalThreeTerms */
export function displayOpToOperationToken(s: string | null): Operation | null {
  return normalizeOperationToken(s);
}

/**
 * מחזור לחיצות על כפתור אופרטור: null ריק, אחר כך רק אופרטורים מותרים בסדר קבוע.
 * אם הרשימה ריקה — מתנהג כמו כל האופרטורים (לא אמור לקרות במשחק אמיתי).
 */
export function buildEqOpDisplayCycle(enabledOperators: readonly Operation[]): (string | null)[] {
  const normalized = enabledOperators
    .map((op) => normalizeOperationToken(op))
    .filter((op): op is Operation => op != null);
  const allow = normalized.length > 0 ? new Set(normalized) : new Set(OP_ORDER);
  const out: (string | null)[] = [null];
  for (const o of OP_ORDER) {
    if (allow.has(o)) out.push(operationToDisplayOp(o));
  }
  return out;
}
