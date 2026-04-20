import { t } from '../../../shared/i18n/format';

const NEW_TUTORIAL_KEYS = [
  'tutorial.variant.second',
  'tutorial.fan.guide',
  'tutorial.fractions.askTitle',
  'tutorial.fractions.askBody',
  'tutorial.fractions.yes',
  'tutorial.fractions.no',
  // Lesson 2 — tap a card
  'tutorial.l2.title',
  'tutorial.l2.botTap',
  'tutorial.l2.hintTap',
  'tutorial.l2.celebrate',
  // Lesson 3 — dice
  'tutorial.l3.title',
  'tutorial.l3.botRoll',
  'tutorial.l3.hintRoll',
  'tutorial.l3.celebrate',
  // Lesson 4 — build equation
  'tutorial.l4.title',
  'tutorial.l4.botBuild',
  'tutorial.l4.hintTap',
  'tutorial.l4.celebrate',
  // Lesson 4b — fill missing die
  'tutorial.l4b.botFillDie',
  'tutorial.l4b.hintFillDie',
  'tutorial.l4b.celebrate',
  // Lesson 4c — full build
  'tutorial.l4c.botFull',
  'tutorial.l4c.hintFull',
  'tutorial.l4c.celebrate',
  // After signs — fractions branch + lesson 6
  'tutorial.fracBranch.title',
  'tutorial.fracBranch.body',
  'tutorial.fracBranch.prompt',
  'tutorial.fracBranch.advancedBtn',
  'tutorial.fracBranch.finishBtn',
  'tutorial.l6.title',
  'tutorial.l6.desc',
  'tutorial.l6.intro.bot',
  'tutorial.l6.intro.hint',
  'tutorial.l6.intro.celebrate',
  'tutorial.l6.theory.bot',
  'tutorial.l6.theory.hint',
  'tutorial.l6.theory.celebrate',
  'tutorial.l6.attackHalf.bot',
  'tutorial.l6.attackHalf.hint',
  'tutorial.l6.attackHalf.celebrate',
  'tutorial.l6.attackThird.bot',
  'tutorial.l6.attackThird.hint',
  'tutorial.l6.attackThird.celebrate',
  'tutorial.l6.defendHalf.bot',
  'tutorial.l6.defendHalf.hint',
  'tutorial.l6.defendHalf.celebrate',
  'tutorial.l6.defendThird.bot',
  'tutorial.l6.defendThird.hint',
  'tutorial.l6.defendThird.celebrate',
] as const;

describe('tutorial i18n keys', () => {
  for (const key of NEW_TUTORIAL_KEYS) {
    it(`resolves ${key} in en/he`, () => {
      const en = t('en', key);
      const he = t('he', key);
      expect(en).toBeTruthy();
      expect(he).toBeTruthy();
      expect(en).not.toBe(key);
      expect(he).not.toBe(key);
    });
  }
});
