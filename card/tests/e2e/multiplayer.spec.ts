import { test, expect } from '../support/fixtures';

test.describe('Multiplayer two-context sync', () => {
  test('Given two browser contexts, When player A creates a room and player B joins, Then both see each other in the lobby', async ({
    browser,
  }) => {
    test.skip(!process.env.RUN_MULTIPLAYER, 'Set RUN_MULTIPLAYER=1 to enable (requires server)');

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await pageA.goto('/');
    await pageA.getByTestId('lobby-create-room').click();
    const code = (await pageA.getByTestId('room-code').textContent())?.trim() ?? '';
    expect(code).toMatch(/^[A-Z0-9]{4,6}$/);

    await pageB.goto('/');
    await pageB.getByTestId('lobby-join-room').click();
    await pageB.getByTestId('room-code-input').fill(code);
    await pageB.getByTestId('room-code-submit').click();

    await expect(pageA.getByTestId('opponent-name')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByTestId('opponent-name')).toBeVisible({ timeout: 15_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
