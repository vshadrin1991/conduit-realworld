import type { Locator } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

export class Header extends BaseComponent {
  readonly root: Locator = this.page.getByRole('navigation').first();
  readonly logo: Locator = this.root.getByRole('link', { name: 'conduit' });
  readonly homeLink: Locator = this.root.getByRole('link', { name: 'Home' });
  readonly newArticleLink: Locator = this.root.getByRole('link', { name: 'New Article' });
  readonly loginLink: Locator = this.root.getByRole('link', { name: 'Login' });
  readonly signUpLink: Locator = this.root.getByRole('link', { name: 'Sign up' });
  readonly sourceCodeLink: Locator = this.root.getByRole('link', { name: 'Source code' });
  readonly userMenu: Locator = this.root.locator('.dropdown-toggle');

  /**
   * Returns the avatar of the signed-in user in the header menu.
   * @param username - name of the signed-in user
   * @return locator of the avatar image
   */
  userAvatar(username: string): Locator {
    return this.userMenu.getByRole('img', { name: username });
  }

  /**
   * Returns an item of the opened user menu.
   * @param name - visible name of the menu item
   * @return locator of the menu item
   */
  menuItem(name: 'Profile' | 'Settings' | 'Logout'): Locator {
    return this.root.locator('.dropdown-item', { hasText: name });
  }
}
