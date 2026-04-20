import type { Page, Locator } from '@playwright/test';

export class GamePage {
  constructor(private readonly page: Page) {}

  readonly playerHand: Locator = this.page.getByTestId('player-hand');
  readonly opponentHand: Locator = this.page.getByTestId('opponent-hand');
  readonly equationArea: Locator = this.page.getByTestId('equation-area');
  readonly diceArea: Locator = this.page.getByTestId('dice-area');
  readonly endTurnButton: Locator = this.page.getByTestId('end-turn');
  readonly rollDiceButton: Locator = this.page.getByTestId('roll-dice');

  card(value: number | string): Locator {
    return this.page.getByTestId(`card-${value}`);
  }

  async waitReady() {
    await this.equationArea.waitFor({ state: 'visible' });
  }
}
