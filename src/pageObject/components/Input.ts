import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class Input extends BaseComponent {
  async getInput(locator: Locator): Promise<Locator> {
    const editable = await locator.evaluate(
      (el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable,
    );
    return editable ? locator : locator.locator('input, textarea').first();
  }

  async enter(locator: Locator, text: string | number, { blur = true }: { blur?: boolean } = {}): Promise<void> {
    const input = await this.getInput(locator);
    const secret = (await input.getAttribute('type')) === 'password';
    this.log.debug(`Enter "${secret ? '******' : text}" into ${locator}`);
    await input.fill(String(text));
    if (blur) await input.blur();
  }

  async sendKeys(locator: Locator, text: string | number, { blur = false }: { blur?: boolean } = {}): Promise<void> {
    const input = await this.getInput(locator);
    this.log.debug(`Send keys into ${locator}`);
    await input.pressSequentially(String(text));
    if (blur) await input.blur();
  }

  async clear(locator: Locator): Promise<void> {
    this.log.debug(`Clear ${locator}`);
    await (await this.getInput(locator)).clear();
  }

  async getValue(locator: Locator): Promise<string> {
    return (await this.getInput(locator)).inputValue();
  }

  async getAttribute(locator: Locator, attribute: string): Promise<string | null> {
    this.log.debug(`Get attribute "${attribute}" of ${locator}`);
    return (await this.getInput(locator)).getAttribute(attribute);
  }

  async verifyValue(locator: Locator, value: string | number): Promise<void> {
    await expect(await this.getInput(locator)).toHaveValue(String(value));
  }
}
