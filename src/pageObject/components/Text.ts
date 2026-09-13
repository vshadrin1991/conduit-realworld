import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class Text extends BaseComponent {
  elementByText(text: string): Locator {
    return this.page.getByText(text);
  }

  async getText(locator: Locator): Promise<string> {
    return (await locator.innerText()).trim();
  }

  /** Texts of all elements matched by the locator (does not wait for a specific count). */
  async getTexts(locator: Locator): Promise<string[]> {
    return (await locator.allInnerTexts()).map((text) => text.trim());
  }

  /** Waits until the element contains the text. */
  async waitTextExist(locator: Locator, expectedText: string): Promise<void> {
    this.log.debug(`Wait for text "${expectedText}" in ${locator}`);
    await expect(locator).toContainText(expectedText);
  }

  /** Asserts that the text is visible anywhere on the page. */
  async verifyTextExists(expectedText: string): Promise<void> {
    this.log.debug(`Verify text "${expectedText}" is visible`);
    await expect(this.elementByText(expectedText).first()).toBeVisible();
  }
}
