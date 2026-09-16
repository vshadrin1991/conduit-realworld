import type { Locator } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

export class Button extends BaseComponent {
  /**
   * Clicks the element.
   * @param locator - element to click
   */
  async click(locator: Locator): Promise<void> {
    this.log.debug(`Click ${locator}`);
    await locator.click();
  }
}
