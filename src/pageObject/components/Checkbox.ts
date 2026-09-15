import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class Checkbox extends BaseComponent {
  /**
   * Checks the checkbox; an already checked one is left as it is.
   * @param locator - checkbox to check
   */
  async check(locator: Locator): Promise<void> {
    if (await locator.isChecked()) {
      this.log.debug(`${locator} is already checked`);
      return;
    }
    this.log.debug(`Check ${locator}`);
    await locator.check();
  }

  /**
   * Unchecks the checkbox; an already unchecked one is left as it is.
   * @param locator - checkbox to uncheck
   */
  async uncheck(locator: Locator): Promise<void> {
    if (!(await locator.isChecked())) {
      this.log.debug(`${locator} is already unchecked`);
      return;
    }
    this.log.debug(`Uncheck ${locator}`);
    await locator.uncheck();
  }

  /**
   * Asserts the checked state of the checkbox.
   * @param locator - checkbox to verify
   * @param checked - expected state: `true` checked, `false` unchecked
   */
  async verifyStatus(locator: Locator, checked: boolean): Promise<void> {
    await expect(locator).toBeChecked({ checked });
  }
}
