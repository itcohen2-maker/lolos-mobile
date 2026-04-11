// Tests that new i18n keys for vs-bot feature resolve correctly in both locales.
// See spec §0.7 for the key split rationale.

// Determine the t() import path from the project's i18n format module.
// Path from card/src/bot/__tests__/ to card/shared/i18n/format.ts is '../../../shared/i18n/format'.
import { t } from '../../../shared/i18n/format';

const NEW_KEYS = [
  'start.mode',
  'start.modePassAndPlay',
  'start.modeVsBot',
  'start.botDifficulty',
  'start.botEasy',
  'start.botHard',
  'start.advancedSettings',
  'botOffline.botName',
  'botOffline.thinking',
] as const;

describe('vs-bot i18n keys', () => {
  for (const key of NEW_KEYS) {
    it(`resolves ${key} in English`, () => {
      const value = t('en', key);
      expect(value).toBeTruthy();
      expect(value).not.toContain('MISSING');
      expect(value).not.toBe(key); // If t() falls back to the key itself, it's missing
    });

    it(`resolves ${key} in Hebrew`, () => {
      const value = t('he', key);
      expect(value).toBeTruthy();
      expect(value).not.toContain('MISSING');
      expect(value).not.toBe(key);
    });
  }
});
