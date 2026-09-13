import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class Checkbox extends BaseComponent {
  /** Checks the checkbox; no-op when it is already checked. */
  async check(locator: Locator): Promise<void> {
    if (await locator.isChecked()) {
      this.log.debug(`${locator} is already checked`);
      return;
    }
    this.log.debug(`Check ${locator}`);
    await locator.check();
  }

  /** Unchecks the checkbox; no-op when it is already unchecked. */
  async uncheck(locator: Locator): Promise<void> {
    if (!(await locator.isChecked())) {
      this.log.debug(`${locator} is already unchecked`);
      return;
    }
    this.log.debug(`Uncheck ${locator}`);
    await locator.uncheck();
  }

  async getStatus(locator: Locator): Promise<boolean> {
    return locator.isChecked();
  }

  async isDisabled(locator: Locator): Promise<boolean> {
    return locator.isDisabled();
  }

  async verifyStatus(locator: Locator, checked: boolean): Promise<void> {
    await expect(locator).toBeChecked({ checked });
  }
}
