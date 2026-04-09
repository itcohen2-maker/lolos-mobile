import type { AppLocale } from '../../shared/i18n/types';
import { t } from '../../shared/i18n';

export function welcomeGameBody(locale: AppLocale): string {
  return t(locale, 'welcome.body');
}

/** Full notification body including good-luck line (for any code still composing local notifications). */
export function welcomeGameNotificationBody(locale: AppLocale): string {
  return `${t(locale, 'welcome.body')}\n${t(locale, 'welcome.goodLuck')}`;
}
