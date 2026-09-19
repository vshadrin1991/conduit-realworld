import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type ButtonName = 'followers' | 'editProfileSettings' | 'myArticles' | 'favoritedArticles';

export class ProfilePage extends BasePage<never, ButtonName> {
  protected readonly root = this.page.locator('.profile-page');

  readonly userInfo: Locator = this.root.locator('.user-info');
  readonly avatar: Locator = this.userInfo.getByRole('img');
  readonly username: Locator = this.userInfo.getByRole('heading');
  readonly bio: Locator = this.userInfo.locator('p');
  readonly followersCount: Locator = this.userInfo.locator('.counter');
  readonly followersButton: Locator = this.userInfo.getByRole('button', { name: /follow/i });
  readonly profileTabs: Locator = this.root.locator('.articles-toggle .nav-link');
  readonly articlePreviews: Locator = this.root.locator('.article-preview');
  readonly articleTagLists: Locator = this.articlePreviews.locator('ul.tag-list');
  readonly loadingHint: Locator = this.articlePreviews.locator('em');

  protected readonly buttons: Record<ButtonName, Locator> = {
    followers: this.followersButton,
    editProfileSettings: this.userInfo.getByRole('link', { name: 'Edit Profile Settings' }),
    myArticles: this.root.getByRole('link', { name: 'My Articles' }),
    favoritedArticles: this.root.getByRole('link', { name: 'Favorited Articles' }),
  };

  /**
   * Returns the profile tab with the name, such as `My Articles` or `Favorited Articles`.
   * @param name - text of the tab
   * @return locator of the tab link
   */
  profileTab(name: string): Locator {
    return this.root.locator('.articles-toggle').getByRole('link', { name });
  }

  /**
   * Returns the article preview card with the title.
   * @param title - article title
   * @return locator of the preview card
   */
  articlePreview(title: string): Locator {
    return this.articlePreviews.filter({ hasText: title });
  }

  /**
   * Returns the link that opens the article from its preview card.
   * @param title - article title
   * @return locator of the title link
   */
  articleLink(title: string): Locator {
    return this.articlePreview(title).getByRole('link', { name: title });
  }
}
