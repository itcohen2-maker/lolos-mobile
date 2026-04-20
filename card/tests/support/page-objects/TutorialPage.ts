import type { Page, Locator } from '@playwright/test';

export class TutorialPage {
  constructor(private readonly page: Page) {}

  readonly nextButton: Locator = this.page.getByTestId('tutorial-next');
  readonly previousButton: Locator = this.page.getByTestId('tutorial-prev');
  readonly skipButton: Locator = this.page.getByTestId('tutorial-skip');
  readonly stepIndicator: Locator = this.page.getByTestId('tutorial-step-indicator');
  readonly narrationText: Locator = this.page.getByTestId('tutorial-narration');

  async goto() {
    await this.page.goto('/?screen=tutorial');
  }

  async advance() {
    await this.nextButton.click();
  }
}
