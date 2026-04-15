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
  'start.botNameLabel',
  'start.botNamePlaceholder',
  'start.botMedium',
  'start.botHard',
  'lobby.botDifficultyLabel',
  'start.advancedSettings',
  'botOffline.botName',
  'botOffline.thinking',
  'game.botDifficultyButton',
  'game.onlineBotDifficultyTitle',
  'game.onlineBotDifficultyHostHint',
  'game.onlineBotDifficultyViewerHint',
  'game.onlineBotDifficultyCurrent',
  'game.botEquationRevealTitle',
  'game.botEquationRevealResult',
  'game.botLearn.step1',
  'game.botLearn.step2',
  'game.botLearn.step3',
  'game.hostOnlyBotDifficulty',
  'game.noBotInRoom',
  'game.invalidBotDifficulty',
  'start.advancedSetup.fractionsLockedLowRange',
  'mp.reconnecting',
  'mp.connectError',
  'mp.connectTimeoutTunnelHint',
  'lobby.advancedToggleShow',
  'lobby.advancedToggleHide',
  'lobby.rulesModalClose',
  'welcome.bodyNoPossibleResults',
  'rules.sessionContextTitle',
  'rules.sessionContextLine',
  'rules.sessionWithFractions',
  'rules.sessionNoFractions',
  'start.advancedSetup.back',
  'start.advancedSetup.sectionPlayModeHeading',
  'start.advancedSetup.sectionPlayModeIntro',
  'start.advancedSetup.botLevelsHint',
  'meter.excellenceTitle',
  'meter.demoCaption',
] as const;

const PREVIEW_I18N_KEYS = [
  'previewOffer.title',
  'previewOffer.body',
  'previewOffer.watch',
  'previewOffer.noThanks',
  'previewOffer.openManual',
  'previewTeaser.skip',
  'previewTeaser.line1',
  'previewTeaser.line2',
  'previewTeaser.line3',
  'previewTeaser.line4',
  'previewTeaser.reducedTitle',
  'previewTeaser.reducedBody',
  'previewTeaser.reducedContinue',
  'previewDemo.introTitle',
  'previewDemo.introBody',
  'previewDemo.rollCaption',
  'previewDemo.diceMathCaption',
  'previewDemo.dicePoolLabel',
  'previewDemo.dicePoolValues',
  'previewDemo.possibleTargetsTitle',
  'previewDemo.possibleTargetsMore',
  'previewDemo.diceMathFootnote',
  'previewDemo.diceIdeas',
  'previewDemo.exampleEqLabel',
  'previewDemo.equationCaption',
  'previewDemo.handSingleCaption',
  'previewDemo.handPairCaption',
  'previewDemo.tapHintsCaption',
  'previewDemo.outroCaption',
  'previewDemo.pileLabel',
  'previewDemo.pairEquals',
  'previewDemo.tapWild',
  'previewDemo.cornerTitle',
  'previewDemo.cornerFractionA11y',
  'previewDemo.wildA11y',
  'previewDemo.branchWildTitle',
  'previewDemo.branchWildBody',
  'previewDemo.branchFractionTitle',
  'previewDemo.branchFractionBody',
  'previewDemo.overlayContinue',
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

describe('gameplay preview i18n keys', () => {
  for (const key of PREVIEW_I18N_KEYS) {
    it(`resolves ${key} in English`, () => {
      const value = t('en', key);
      expect(value).toBeTruthy();
      expect(value).not.toContain('MISSING');
      expect(value).not.toBe(key);
    });

    it(`resolves ${key} in Hebrew`, () => {
      const value = t('he', key);
      expect(value).toBeTruthy();
      expect(value).not.toContain('MISSING');
      expect(value).not.toBe(key);
    });
  }
});
