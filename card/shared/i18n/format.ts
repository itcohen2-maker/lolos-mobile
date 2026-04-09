import type { AppLocale, LastMovePayload, LocalizedMessage, MsgParams } from './types';
import { he } from './he';
import { en } from './en';

const tables: Record<AppLocale, Record<string, string>> = { he, en };

function interpolate(template: string, params?: MsgParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = params[name];
    return v == null ? '' : String(v);
  });
}

export function t(locale: AppLocale, key: string, params?: MsgParams): string {
  const table = tables[locale] ?? tables.he;
  const template = table[key] ?? tables.en[key] ?? tables.he[key] ?? key;
  return interpolate(template, params);
}

export function formatGameMessage(locale: AppLocale, msg: LocalizedMessage | ''): string {
  if (msg === '') return '';
  return t(locale, msg.key, msg.params);
}

export function formatLastMove(locale: AppLocale, payload: LastMovePayload): string | null {
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    return payload.map((m) => t(locale, m.key, m.params)).join(' ');
  }
  return t(locale, payload.key, payload.params);
}

/** Deep-stable compare for deduping broadcasts */
export function lastMoveSignature(payload: LastMovePayload): string | null {
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    return JSON.stringify(payload.map((m) => [m.key, m.params ?? {}]));
  }
  return JSON.stringify([payload.key, payload.params ?? {}]);
}
