import type { Page, Locator } from '@playwright/test';

export class LobbyPage {
  constructor(private readonly page: Page) {}

  readonly playSinglePlayer: Locator = this.page.getByTestId('lobby-single-player');
  readonly playWithBot: Locator = this.page.getByTestId('lobby-play-bot');
  readonly createRoom: Locator = this.page.getByTestId('lobby-create-room');
  readonly joinRoom: Locator = this.page.getByTestId('lobby-join-room');
  readonly tutorialButton: Locator = this.page.getByTestId('lobby-tutorial');
  readonly languageToggle: Locator = this.page.getByTestId('lobby-language-toggle');

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }
}
