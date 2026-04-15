// ============================================================
// shared/validation.ts — Input validation & sanitization
// Used by both server and client for consistent validation
// ============================================================

import type { AppLocale } from './i18n';
import type { Operation } from './types';

/**
 * Sanitize a player name: trim, strip control chars and basic HTML,
 * enforce length 1–24. Returns null if invalid.
 */
export function sanitizePlayerName(raw: unknown, maxLen = 24): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw
    .replace(/[\r\n\x00-\x1f\x7f]/g, '')       // control chars
    .replace(/<[^>]*>/g, '')                      // HTML tags
    .replace(/&[a-z]+;/gi, '')                    // HTML entities
    .trim()
    .slice(0, maxLen);
  return stripped.length > 0 ? stripped : null;
}

/**
 * Validate a room code (4 digits).
 * Returns the code string or null if invalid.
 */
export function validateRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : null;
}

/**
 * Validate a card ID (format: card-<digits> or c-<hex>).
 * Returns the ID or null if invalid.
 */
export function validateCardId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length > 40) return null;
  // Support both old sequential (card-123) and new random (c-abcdef012345) formats
  if (/^card-\d+$/.test(trimmed)) return trimmed;
  if (/^c-[0-9a-f]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Validate wildResolve: must be a non-negative integer within [0, maxRange].
 * Returns the number or null if invalid.
 */
export function validateWildResolve(raw: unknown, maxRange: number): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > maxRange) return null;
  return n;
}

/**
 * Validate locale. Returns 'he' or 'en', defaulting to 'he'.
 */
export function validateLocale(raw: unknown): AppLocale {
  if (raw === 'en') return 'en';
  return 'he';
}

/**
 * Validate difficulty level.
 * Returns 'easy' | 'full' or null if invalid.
 */
export function validateDifficulty(raw: unknown): 'easy' | 'full' | null {
  if (raw === 'easy' || raw === 'full') return raw;
  return null;
}

/**
 * Validate an operation token.
 * Returns a canonical Operation or null if invalid.
 */
export function validateOperation(raw: unknown): Operation | null {
  if (typeof raw !== 'string') return null;
  switch (raw) {
    case '+': case '-': case 'x': case '÷': return raw;
    case '*': case '×': return 'x';
    case '/': return '÷';
    default: return null;
  }
}

/**
 * Sanitize equation display string: strip control chars, cap length.
 * Returns sanitized string (never null — defaults to empty).
 */
export function sanitizeEquationDisplay(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 200);
}

/**
 * Validate a UUID-formatted string.
 * Returns the UUID or null if invalid.
 */
export function validatePlayerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Validate a bot difficulty level.
 * Returns 'easy' | 'medium' | 'hard' or null if invalid.
 */
export function validateBotDifficulty(raw: unknown): 'easy' | 'medium' | 'hard' | null {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return null;
}
