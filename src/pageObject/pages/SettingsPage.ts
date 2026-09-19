import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'image' | 'username' | 'bio' | 'email' | 'password';
type ButtonName = 'updateSettings';

export class SettingsPage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.getByRole('heading', { name: 'Your Settings' });

  protected readonly fields: Record<FieldName, Locator> = {
    image: this.page.getByPlaceholder('URL of profile picture'),
    username: this.page.getByPlaceholder('Your Name'),
    bio: this.page.getByPlaceholder('Short bio about you'),
    email: this.page.getByPlaceholder('Email'),
    password: this.page.getByPlaceholder('Password'),
  };

  protected readonly errors: Partial<Record<FieldName, Locator>> = {
    email: this.page.locator('.error-messages'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    updateSettings: this.page.getByRole('button', { name: 'Update Settings' }),
  };

  readonly errorMessages: Locator = this.page.locator('.error-messages');

  /**
   * Returns the server error line with the message.
   * @param message - text of the server error
   * @return locator of the error line
   */
  errorMessage(message: string): Locator {
    return this.errorMessages.getByText(message);
  }
}
