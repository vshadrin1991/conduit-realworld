import type { Locator } from '@playwright/test';
import { BaseComponent } from '@/base/BaseComponent';

/** Top navigation bar, available on every page as `page.header`. */
export class Header extends BaseComponent {
  readonly root: Locator = this.page.getByRole('navigation').first();
  readonly homeLink: Locator = this.root.getByRole('link', { name: 'Home' });
  readonly newArticleLink: Locator = this.root.getByRole('link', { name: 'New Article' });
  readonly loginLink: Locator = this.root.getByRole('link', { name: 'Login' });
  readonly signUpLink: Locator = this.root.getByRole('link', { name: 'Sign up' });
  /** Dropdown toggle with the avatar of the logged-in user. */
  readonly userMenu: Locator = this.root.locator('.dropdown-toggle');

  userAvatar(username: string): Locator {
    return this.userMenu.getByRole('img', { name: username });
  }

  /** Item of the user dropdown; open `userMenu` first. */
  menuItem(name: 'Profile' | 'Settings' | 'Logout'): Locator {
    return this.root.locator('.dropdown-item', { hasText: name });
  }
}
