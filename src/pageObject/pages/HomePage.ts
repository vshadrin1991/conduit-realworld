import { expect, type Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type ButtonName = 'globalFeed' | 'yourFeed';

export class HomePage extends BasePage<never, ButtonName> {
  protected readonly root = this.page.getByRole('button', { name: 'Global Feed' });

  protected readonly buttons: Record<ButtonName, Locator> = {
    globalFeed: this.page.getByRole('button', { name: 'Global Feed' }),
    yourFeed: this.page.getByRole('button', { name: 'Your Feed' }),
  };

  readonly banner: Locator = this.page.locator('.banner');
  readonly bannerTitle: Locator = this.banner.locator('h1');
  readonly bannerTagline: Locator = this.banner.locator('p');
  readonly feedTabs: Locator = this.page.locator('.feed-toggle .nav-item button');
  readonly selectedFeedTab: Locator = this.page.locator('.feed-toggle button.nav-link.active');
  readonly popularTags: Locator = this.page.locator('.sidebar .tag-list button');
  readonly pagination: Locator = this.page.getByRole('navigation', { name: 'Pagination' });
  readonly lastFeedPage: Locator = this.pagination.getByRole('button', { name: /^Page \d+$/ }).last();
  readonly articlePreviews: Locator = this.page.locator('.article-preview');
  readonly articleTitles: Locator = this.articlePreviews.locator('h1');
  readonly articleTagLists: Locator = this.articlePreviews.locator('ul.tag-list');

  /**
   * Returns the feed tab with the name, such as `Global Feed`, `Your Feed` or a tag name.
   * @param name - text of the tab
   * @return locator of the tab button
   */
  feedTab(name: string): Locator {
    return this.feedTabs.filter({ hasText: name });
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
   * Returns the author link of the article preview card.
   * @param title - article title
   * @return locator of the author link
   */
  articleAuthorLink(title: string): Locator {
    return this.articlePreview(title).locator('a.author');
  }

  /**
   * Returns the tags listed on the article preview card.
   * @param title - article title
   * @return locator of the tag items
   */
  articleTags(title: string): Locator {
    return this.articlePreview(title).locator('ul.tag-list li');
  }

  /**
   * Returns the favorite counter of the article preview card.
   * @param title - article title
   * @return locator of the counter next to the favorite button
   */
  articleFavoriteCount(title: string): Locator {
    return this.articlePreview(title).locator('span.counter');
  }

  /**
   * Returns the link that opens the article from its preview card.
   * @param title - article title
   * @return locator of the title link
   */
  articleLink(title: string): Locator {
    return this.articlePreview(title).getByRole('link', { name: title });
  }

  /**
   * Returns the feed pagination button of the page number, whether it is the current page or not.
   * @param pageNumber - feed page number, starting from 1
   * @return locator of the pagination button
   */
  feedPageButton(pageNumber: number): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^Page ${pageNumber}( is your current page)?$`) });
  }

  /**
   * Finds the article preview in the feed, opening the next feed page while it is missing, and throws when the
   * article is not on the first `maxPages` pages.
   * @param title - article title
   * @param options - `maxPages` to check (3 by default) and `timeout` in ms to wait on each page (5000 by default)
   * @return locator of the visible article preview
   */
  async findArticleInFeed(title: string, { maxPages = 3, timeout = 5_000 } = {}): Promise<Locator> {
    await this;
    const preview = this.articlePreview(title);
    for (let pageNumber = 1; ; pageNumber++) {
      const found = await preview.waitFor({ state: 'visible', timeout }).then(
        () => true,
        () => false,
      );
      if (found) return preview;
      if (pageNumber === maxPages)
        throw new Error(`Article "${title}" was not found on the first ${maxPages} feed pages`);
      this.log.info(`"${title}" is not on feed page ${pageNumber}, opening page ${pageNumber + 1}`);
      await this.button.click(this.feedPageButton(pageNumber + 1));
      await expect(this.feedPageButton(pageNumber + 1)).toHaveAccessibleName(
        `Page ${pageNumber + 1} is your current page`,
      );
    }
  }
}
