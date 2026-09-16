import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

export class Input extends BaseComponent {
  /**
   * Resolves the editable element: the locator itself, or the first input or textarea inside it.
   * @param locator - input, textarea, contenteditable element or a wrapper around one
   * @return locator of the editable element
   */
  async getInput(locator: Locator): Promise<Locator> {
    const editable = await locator.evaluate(
      (el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable,
    );
    return editable ? locator : locator.locator('input, textarea').first();
  }

  /**
   * Replaces the value of the input and moves the focus out of it (password values are masked in logs).
   * @param locator - input or a wrapper around one
   * @param text - value to enter
   */
  async enter(locator: Locator, text: string | number): Promise<void> {
    const input = await this.getInput(locator);
    const secret = (await input.getAttribute('type')) === 'password';
    this.log.debug(`Enter "${secret ? '******' : text}" into ${locator}`);
    await input.fill(String(text));
    await input.blur();
  }

  /**
   * Asserts the current value of the input.
   * @param locator - input or a wrapper around one
   * @param value - expected value
   */
  async verifyValue(locator: Locator, value: string | number): Promise<void> {
    await expect(await this.getInput(locator)).toHaveValue(String(value));
  }
}
