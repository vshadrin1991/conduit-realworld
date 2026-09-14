import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'email' | 'password';
type ButtonName = 'login';

export class LoginPage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.getByRole('heading', { name: 'Sign in' });

  protected readonly fields: Record<FieldName, Locator> = {
    email: this.page.getByPlaceholder('Email'),
    password: this.page.getByPlaceholder('Password'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    login: this.page.getByRole('button', { name: 'Login' }),
  };

  readonly errorMessages: Locator = this.page.locator('.error-messages');
}
