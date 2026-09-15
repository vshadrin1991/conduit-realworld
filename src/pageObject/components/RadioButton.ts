import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

export class RadioButton extends BaseComponent {
  /**
   * Selects the radio button; an already selected one is left as it is.
   * @param locator - radio button to select
   */
  async click(locator: Locator): Promise<void> {
    if (await locator.isChecked()) {
      this.log.debug(`${locator} is already selected`);
      return;
    }
    this.log.debug(`Select ${locator}`);
    await locator.check();
  }

  /**
   * Asserts the selected state of the radio button.
   * @param locator - radio button to verify
   * @param selected - expected state: `true` selected, `false` not selected
   */
  async verifyStatus(locator: Locator, selected: boolean): Promise<void> {
    await expect(locator).toBeChecked({ checked: selected });
  }
}
