import { test, expect } from '../support/fixtures';

test.describe('Slinda turn-transition flow', () => {
  test('Given a Slinda-owned profile, when the player opens the modal, then card selection is interactive and confirm consumes Slinda', async ({
    page,
    lobby,
  }) => {
    let slindaOwned = true;

    await page.route('**/rest/v1/profiles*', async (route) => {
      const url = new URL(route.request().url());
      const rawId = url.searchParams.get('id') ?? 'eq.e2e-user';
      const userId = rawId.startsWith('eq.') ? rawId.slice(3) : rawId;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: userId,
          username: 'Tester',
          rating: 1000,
          wins: 0,
          losses: 0,
          total_coins: 250,
          slinda_owned: slindaOwned,
          themes_owned: [],
          table_skins_owned: [],
          active_card_back: 'default',
          active_table_theme: 'default',
          active_table_skin: 'classic_green',
        }),
      });
    });

    await page.route('**/rest/v1/rpc/consume_slinda', async (route) => {
      slindaOwned = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify('ok'),
      });
    });

    await lobby.goto();
    await lobby.playSinglePlayer.click();
    await page.getByTestId('start-lets-play').click();

    const openButton = page.getByTestId('turn-slinda-open');
    await expect(openButton).toBeVisible({ timeout: 30_000 });
    await openButton.click();

    const modal = page.getByTestId('slinda-modal');
    const confirmButton = page.getByTestId('slinda-confirm');
    await expect(modal).toBeVisible();
    await expect(confirmButton).toHaveAttribute('aria-disabled', 'true');

    const options = page.locator('[data-testid^="slinda-option-"]');
    await expect(options).toHaveCount(10);
    await options.first().click();

    await expect(confirmButton).toHaveAttribute('aria-disabled', 'false');
    await confirmButton.click();

    await expect(modal).toBeHidden({ timeout: 15_000 });
    await expect(openButton).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('turn-im-ready')).toBeVisible();
  });
});
