import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'comment';
type ButtonName = 'deleteArticle' | 'editArticle' | 'postComment';

export class ArticlePage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.locator('.article-page');

  protected readonly fields: Record<FieldName, Locator> = {
    comment: this.root.getByPlaceholder('Write a comment...'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    deleteArticle: this.root.getByRole('button', { name: 'Delete Article' }).first(),
    editArticle: this.root.getByRole('link', { name: 'Edit Article' }).first(),
    postComment: this.root.getByRole('button', { name: 'Post Comment' }),
  };

  readonly title: Locator = this.root.locator('.banner h1');
  readonly body: Locator = this.root.locator('.article-content');
  readonly tags: Locator = this.root.locator('.tag-list li');
  readonly comments: Locator = this.root.locator('.card:not(.comment-form)');

  /**
   * Reads the slug of the opened article from the URL.
   * @return article slug, or an empty string when no article is open
   */
  get slug(): string {
    return decodeURIComponent(this.page.url().split('#/article/')[1] ?? '');
  }

  /**
   * Returns the comment card that contains the text.
   * @param text - text of the comment
   * @return locator of the comment card
   */
  comment(text: string): Locator {
    return this.comments.filter({ has: this.page.locator('.card-text', { hasText: text }) });
  }
}
