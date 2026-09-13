import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'comment';
type ButtonName = 'deleteArticle' | 'editArticle' | 'postComment';

export class ArticlePage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.locator('.article-page');

  protected readonly fields: Record<FieldName, Locator> = {
    comment: this.root.getByPlaceholder('Write a comment...'),
  };

  // Author actions are rendered twice (banner + below the body); the banner copy is used.
  // Deleting opens a native confirm dialog — accept it with the Confirmation component before clicking.
  protected readonly buttons: Record<ButtonName, Locator> = {
    deleteArticle: this.root.getByRole('button', { name: 'Delete Article' }).first(),
    editArticle: this.root.getByRole('link', { name: 'Edit Article' }).first(),
    postComment: this.root.getByRole('button', { name: 'Post Comment' }),
  };

  readonly title: Locator = this.root.locator('.banner h1');
  readonly body: Locator = this.root.locator('.article-content');
  readonly tags: Locator = this.root.locator('.tag-list li');
  readonly comments: Locator = this.root.locator('.card:not(.comment-form)');

  /** Slug of the article currently open, taken from the URL. */
  get slug(): string {
    return decodeURIComponent(this.page.url().split('#/article/')[1] ?? '');
  }

  comment(text: string): Locator {
    return this.comments.filter({ has: this.page.locator('.card-text', { hasText: text }) });
  }
}
