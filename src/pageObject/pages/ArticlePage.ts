import type { Locator } from '@playwright/test';
import { BasePage } from '@/base/BasePage';

type FieldName = 'comment';
type ButtonName = 'deleteArticle' | 'editArticle' | 'postComment';

export class ArticlePage extends BasePage<FieldName, ButtonName> {
  protected readonly root = this.page.locator('.article-page');

  readonly title: Locator = this.root.locator('.banner h1');
  readonly body: Locator = this.root.locator('.article-content');
  readonly tags: Locator = this.root.locator('.tag-list li');
  readonly comments: Locator = this.root.locator('.card:not(.comment-form)');
  readonly authorBlocks: Locator = this.root.locator('.article-meta');
  readonly authorLinks: Locator = this.authorBlocks.locator('.info a.author');
  readonly authorAvatars: Locator = this.authorBlocks.locator('a img');
  readonly authorDates: Locator = this.authorBlocks.locator('span.date');
  readonly deleteArticleButtons: Locator = this.root.getByRole('button', { name: 'Delete Article' });
  readonly editArticleLinks: Locator = this.root.getByRole('link', { name: 'Edit Article' });
  readonly followButtons: Locator = this.authorBlocks.locator('button.action-btn');
  readonly favoriteButtons: Locator = this.authorBlocks.locator('button', {
    has: this.page.locator('i.ion-heart'),
  });
  readonly commentForm: Locator = this.root.locator('form.comment-form');
  readonly commentPrompt: Locator = this.root.locator('span', { hasText: 'add comments on this article' });
  readonly commentPromptSignIn: Locator = this.commentPrompt.getByRole('link', { name: 'Sign in' });
  readonly commentPromptSignUp: Locator = this.commentPrompt.getByRole('link', { name: 'Sign up' });
  readonly noComments: Locator = this.root.locator('div:not(:has(*))', {
    hasText: 'There are no comments yet',
  });

  protected readonly fields: Record<FieldName, Locator> = {
    comment: this.root.getByPlaceholder('Write a comment...'),
  };

  protected readonly buttons: Record<ButtonName, Locator> = {
    deleteArticle: this.deleteArticleButtons.first(),
    editArticle: this.editArticleLinks.first(),
    postComment: this.root.getByRole('button', { name: 'Post Comment' }),
  };

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

  /**
   * Returns the delete button of the comment card with the text; the app renders it only for the
   * signed-in author of the comment.
   * @param text - text of the comment
   * @return locator of the delete button in the card footer
   */
  commentDeleteButton(text: string): Locator {
    return this.comment(text).locator('.card-footer').getByRole('button');
  }

  /**
   * Returns the author links of the comment card with the text (the avatar and the username link).
   * @param text - text of the comment
   * @return locator of the comment author links
   */
  commentAuthorLinks(text: string): Locator {
    return this.comment(text).locator('a.comment-author');
  }
}
