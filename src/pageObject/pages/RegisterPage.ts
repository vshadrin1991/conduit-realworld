import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'username' | 'email' | 'password';
type ButtonName = 'signUp';

export class RegisterPage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.getByRole('heading', { name: 'Sign up' });

  protected readonly fields: Record<FieldName, Locator> = {
    username: this.page.getByPlaceholder('Your Name'),
    email: this.page.getByPlaceholder('Email'),
    password: this.page.getByPlaceholder('Password'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    signUp: this.page.getByRole('button', { name: 'Sign up' }),
  };

  protected readonly errorMessages: Locator = this.page.locator('.error-messages');
}
