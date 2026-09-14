import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class Text extends BaseComponent {
  elementByText(text: string): Locator {
    return this.page.getByText(text);
  }

  async getText(locator: Locator): Promise<string> {
    return (await locator.innerText()).trim();
  }

  async getTexts(locator: Locator): Promise<string[]> {
    return (await locator.allInnerTexts()).map((text) => text.trim());
  }

  async waitTextExist(locator: Locator, expectedText: string): Promise<void> {
    this.log.debug(`Wait for text "${expectedText}" in ${locator}`);
    await expect(locator).toContainText(expectedText);
  }

  async verifyTextExists(expectedText: string): Promise<void> {
    this.log.debug(`Verify text "${expectedText}" is visible`);
    await expect(this.elementByText(expectedText).first()).toBeVisible();
  }
}
