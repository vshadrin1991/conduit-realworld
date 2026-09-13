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

  articlePreview(title: string): Locator {
    return this.articlePreviews.filter({ hasText: title });
  }

  articleLink(title: string): Locator {
    return this.articlePreview(title).getByRole('link', { name: title });
  }

  feedPageButton(pageNumber: number): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^Page ${pageNumber}( is your current page)?$`) });
  }

  /**
   * Search helper (the one exception to "no multi-step methods"): the feed shows only 3 articles per page and
   * parallel tests keep publishing, so a fresh article may be on page 2+. Returns the preview of the article.
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
      // The list re-renders asynchronously after a tab or page switch, so each page gets time before moving on.
      const found = await preview.waitFor({ state: 'visible', timeout }).then(
        () => true,
        () => false,
      );
      if (found) return preview;
    }
    throw new Error(`Article "${title}" was not found on the first ${maxPages} feed pages`);
  }
}
