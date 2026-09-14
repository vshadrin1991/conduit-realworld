import { expect, type Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type ButtonName = 'globalFeed' | 'yourFeed';

export class HomePage extends BasePage<never, ButtonName> {
  protected readonly root = this.page.getByRole('button', { name: 'Global Feed' });

  protected readonly buttons: Record<ButtonName, Locator> = {
    globalFeed: this.page.getByRole('button', { name: 'Global Feed' }),
    yourFeed: this.page.getByRole('button', { name: 'Your Feed' }),
  };

  readonly articlePreviews: Locator = this.page.locator('.article-preview');

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
    await this.settled();
    const preview = this.articlePreview(title);
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      if (pageNumber > 1) {
        this.log.info(`"${title}" is not on feed page ${pageNumber - 1}, opening page ${pageNumber}`);
        await this.button.click(this.feedPageButton(pageNumber));
        await expect(this.feedPageButton(pageNumber)).toHaveAccessibleName(`Page ${pageNumber} is your current page`);
      }
      const found = await preview.waitFor({ state: 'visible', timeout }).then(
        () => true,
        () => false,
      );
      if (found) return preview;
    }
    throw new Error(`Article "${title}" was not found on the first ${maxPages} feed pages`);
  }
}
