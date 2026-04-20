import { test, expect } from '../support/fixtures';
import { setLocale, expectRtl } from '../support/helpers/locale';
import { failOnConsoleError } from '../support/helpers/network';

/**
 * Tutorial E2E
 *
 * Flow under test:
 *   Lobby → mode picker (local) → StartScreen → "How to play?" → TutorialGameScreen
 *
 * Selectors strategy: text-based (i18n strings) until data-testid attributes
 * land in the lobby/start/tutorial components. See tests/README.md for the
 * required testid table.
 *
 * The deep lesson-by-lesson walkthrough (NEXT_VARIANT, fractions opt-in gate)
 * is currently unit-tested in src/tutorial/__tests__/tutorialFlow.test.ts.
 * The E2E here verifies the user can ENTER the tutorial and reach the first
 * speech bubble — proving the wiring is alive end-to-end.
 */

test.describe('Tutorial entry flow', () => {
  test('Given English locale, When user navigates lobby → How to play, Then tutorial starts in LTR with a speech bubble', async ({
    page,
  }) => {
    await setLocale(page, 'en');
    const assertNoErrors = await failOnConsoleError(page);

    await page.goto('/');

    // Mode picker (rendered when entering local play).
    await page.getByText('Same device (pass & play)').click({ timeout: 30_000 });

    // StartScreen → "How to play?" button.
    await page.getByRole('button', { name: 'How to play?' }).click({ timeout: 15_000 });

    // Tutorial intro overlay or first speech bubble should render.
    // The lesson 1 title comes through `tutorial.lesson1.title`.
    await expect(
      page.getByText(/lesson 1|round 1|tap.*ready|my turn/i).first()
    ).toBeVisible({ timeout: 30_000 });

    await expectRtl(page, false);
    assertNoErrors();
  });

  test('Given Hebrew locale, When user enters tutorial, Then prompt appears in RTL', async ({
    page,
  }) => {
    await setLocale(page, 'he');
    await page.goto('/');

    await page.getByText('משחק על אותה מכשיר', { exact: false }).first().click({ timeout: 30_000 });
    await page.getByRole('button', { name: '?איך משחקים' }).click({ timeout: 15_000 });

    await expectRtl(page, true);
  });
});

test.describe('Tutorial fractions opt-in gate', () => {
  test.skip(
    true,
    'Reaches lesson 4 boundary via real clicks — needs deterministic fast-forward harness ' +
      'or data-testid("tutorial-jump-to-lesson") to be feasible. Reducer logic is covered by ' +
      'src/tutorial/__tests__/tutorialFlow.test.ts.'
  );

  test('Given user has reached the wild-card lesson, When they tap "Next lesson", Then the fractions opt-in dialog opens', async ({
    page,
  }) => {
    // TODO: implement after a deterministic skip-to-lesson hook lands.
    await page.goto('/');
    await expect(page.getByText('Optional Fractions Module')).toBeVisible();
  });

  test('Given the opt-in dialog is open, When user taps "Not now", Then they jump to free play (lesson 6)', async ({
    page,
  }) => {
    // TODO: implement after fast-forward harness exists.
    await page.goto('/');
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByText(/free play|round 6|lesson 6/i)).toBeVisible();
  });
});
