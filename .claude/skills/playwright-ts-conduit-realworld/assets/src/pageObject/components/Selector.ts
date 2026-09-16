import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/pageObject/components/BaseComponent';

export class Selector extends BaseComponent {
  /**
   * Selects an option by its visible label.
   * @param locator - the `<select>` element
   * @param option - visible label of the option
   * @return promise resolved when the option is selected
   */
  async select(locator: Locator, option: string): Promise<void> {
    this.log.debug(`Select "${option}" in ${locator}`);
    await locator.selectOption({ label: option });
  }

  /**
   * Returns the label of the selected option.
   * @param locator - the `<select>` element
   * @return label of the selected option
   */
  async getSelected(locator: Locator): Promise<string> {
    return (await locator.locator('option:checked').innerText()).trim();
  }

  /**
   * Asserts the selected option (web-first: retries until the timeout).
   * @param locator - the `<select>` element
   * @param option - expected label of the selected option
   * @return promise resolved when the assertion passes
   */
  async verifySelected(locator: Locator, option: string): Promise<void> {
    await expect(locator.locator('option:checked')).toHaveText(option);
  }
}
