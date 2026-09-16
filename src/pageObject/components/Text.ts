import type { Locator } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

export class Text extends BaseComponent {
  /**
   * Reads the trimmed visible texts of every element the locator matches.
   * @param locator - elements to read
   * @return texts in document order
   */
  async getTexts(locator: Locator): Promise<string[]> {
    return (await locator.allInnerTexts()).map((text) => text.trim());
  }
}
