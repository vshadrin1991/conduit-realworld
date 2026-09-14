import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class RadioButton extends BaseComponent {
  async click(locator: Locator): Promise<void> {
    if (await this.status(locator)) {
      this.log.debug(`${locator} is already selected`);
      return;
    }
    this.log.debug(`Select ${locator}`);
    await locator.check();
  }

  async status(locator: Locator): Promise<boolean> {
    return locator.isChecked();
  }

  async verifyStatus(locator: Locator, selected: boolean): Promise<void> {
    await expect(locator).toBeChecked({ checked: selected });
  }
}
