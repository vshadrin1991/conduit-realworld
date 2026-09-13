import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class Button extends BaseComponent {
  /** Clicks after Playwright's actionability checks (visible, enabled, stable); `newTab` uses Ctrl/Cmd+click. */
  async click(locator: Locator, { newTab = false }: { newTab?: boolean } = {}): Promise<void> {
    this.log.debug(`Click ${locator}${newTab ? ' in a new tab' : ''}`);
    if (newTab) await locator.click({ modifiers: ['ControlOrMeta'] });
    else await locator.click();
  }

  /** Dispatches a DOM click without actionability checks; use only when a regular click is intercepted. */
  async clickViaJs(locator: Locator): Promise<void> {
    this.log.debug(`Click via JS on ${locator}`);
    await locator.evaluate((el) => (el as HTMLElement).click());
  }

  async isEnabled(locator: Locator): Promise<boolean> {
    return locator.isEnabled();
  }

  async verifyEnabled(locator: Locator, enabled: boolean): Promise<void> {
    await expect(locator).toBeEnabled({ enabled });
  }
}
