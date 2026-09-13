// GOOD EXAMPLE — page object. Location in the project: src/pageObject/pages/SettingsPage.ts (+ Route.settings)
import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'image' | 'username' | 'bio' | 'email' | 'password';
type ButtonName = 'updateSettings';

/**
 * Settings page (`#/settings`). Locators only: tests drive it with the FunctionalPage methods, e.g.
 * `await get(SettingsPage, Route.settings).fillData('bio', bio).clickActionButton('updateSettings')`.
 */
export class SettingsPage extends BasePage<FieldName, ButtonName> {
  // Present only when this page is rendered: navigate() and waitUntilPageLoaded() wait for it.
  protected readonly root = this.page.getByRole('heading', { name: 'Your Settings' });

  // Inputs have no labels in Conduit, so placeholders are the stable locator.
  protected readonly fields: Record<FieldName, Locator> = {
    image: this.page.getByPlaceholder('URL of profile picture'),
    username: this.page.getByPlaceholder('Your Name'),
    bio: this.page.getByPlaceholder('Short bio about you'),
    email: this.page.getByPlaceholder('Email'),
    password: this.page.getByPlaceholder('Password'),
  };

  // Only fields that show validation errors; the server reports them in one block above the form.
  protected readonly errors: Partial<Record<FieldName, Locator>> = {
    email: this.page.locator('.error-messages'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    // Logout is not on this page in Conduit: it lives in the header user menu (`page.header.menuItem('Logout')`).
    updateSettings: this.page.getByRole('button', { name: 'Update Settings' }),
  };

  /** Read-only content is a public locator; tests assert it with web-first assertions. */
  readonly errorMessages: Locator = this.page.locator('.error-messages');

  /**
   * Parametrised element: a method that returns a locator, never one that performs steps.
   * @param message - text of the server error
   * @return locator of the error line
   */
  errorMessage(message: string): Locator {
    return this.errorMessages.getByText(message);
  }
}
