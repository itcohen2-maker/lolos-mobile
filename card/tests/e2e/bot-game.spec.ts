import { test, expect } from '../support/fixtures';

test.describe('Single-player vs Bot', () => {
  test('Given lobby, When user picks "Play with Bot", Then game screen renders with player and opponent hands', async ({
    page,
    lobby,
    game,
  }) => {
    await lobby.goto();
    await lobby.playWithBot.click();

    await game.waitReady();
    await expect(game.playerHand).toBeVisible();
    await expect(game.opponentHand).toBeVisible();
  });
});
