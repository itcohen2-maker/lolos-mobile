import { test, expect } from '../support/fixtures';
import { failOnConsoleError } from '../support/helpers/network';

test.describe('Smoke: app loads', () => {
  test('Given a fresh visit, When the app loads, Then the lobby renders without console errors', async ({
    page,
    lobby,
  }) => {
    const assertNoErrors = await failOnConsoleError(page);

    await lobby.goto();

    await expect(page).toHaveTitle(/.+/);
    await expect(lobby.tutorialButton.or(lobby.playWithBot)).toBeVisible({ timeout: 30_000 });

    assertNoErrors();
  });
});
