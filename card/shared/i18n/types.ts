// ============================================================
// shared/i18n/types.ts — locale + structured messages
// ============================================================

export type AppLocale = 'he' | 'en';

export type MsgParams = Record<string, string | number>;

/** Server + client structured message (resolved to string with t()) */
export interface LocalizedMessage {
  key: string;
  params?: MsgParams;
}

export type LastMovePayload = LocalizedMessage | LocalizedMessage[] | null;

export function isLocalizedMessage(x: unknown): x is LocalizedMessage {
  return typeof x === 'object' && x !== null && 'key' in x && typeof (x as LocalLocalizedMessage).key === 'string';
}

type LocalLocalizedMessage = { key: string; params?: MsgParams };

/** Game state `message` field: empty string or structured */
export type GameStatusMessage = '' | LocalizedMessage;
