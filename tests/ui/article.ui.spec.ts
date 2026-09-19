import { APIClient } from '@/api/client/APIClient';
import { expect, test } from '@/base/BaseTest';
import { Session } from '@/pageObject/components/Session';
import { ArticlePage } from '@/pageObject/pages/ArticlePage';
import { Route } from '@/pageObject/pagePath/Routes';

test.describe('Article page UI', () => {
  test('shows the author block twice with follow and favorite counters for a guest', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(ArticlePage, Route.article(article.slug));

    await expect(get(ArticlePage).authorBlocks).toHaveCount(2);
    await expect(get(ArticlePage).authorAvatars).toHaveCount(2);
    await expect(get(ArticlePage).authorLinks).toHaveCount(2);
    await expect(get(ArticlePage).authorLinks.first()).toHaveAttribute(
      'href',
      `#${Route.profile(article.author.username)}`,
    );
    await expect(get(ArticlePage).authorDates.first()).toHaveText(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    await expect(get(ArticlePage).followButtons).toHaveCount(2);
    await expect(get(ArticlePage).followButtons.first()).toContainText(/\( \d+ \)/);
    await expect(get(ArticlePage).favoriteButtons).toHaveCount(2);
    await expect(get(ArticlePage).favoriteButtons.first()).toContainText(`( ${article.favoritesCount} )`);
    await expect(get(ArticlePage).deleteArticleButtons).toHaveCount(0);
    await expect(get(ArticlePage).editArticleLinks).toHaveCount(0);
  });

  test('guest clicking the followers button gets the login alert', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(ArticlePage, Route.article(article.slug));
    const dialog = get(ArticlePage).confirmation.answerNext('accept');
    await get(ArticlePage).button.click(get(ArticlePage).followButtons.first());

    expect(await dialog).toBe('You need to login first');
    await expect(get(ArticlePage).page).toHaveURL(new RegExp(`#${Route.article(article.slug)}$`));
  });

  test('guest sees the sign-in prompt instead of the comment form', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(ArticlePage, Route.article(article.slug));

    await expect(get(ArticlePage).commentPrompt).toHaveText(
      'Sign in or Sign up to add comments on this article.',
    );
    await expect(get(ArticlePage).commentPromptSignIn).toHaveAttribute('href', `#${Route.login}`);
    await expect(get(ArticlePage).commentPromptSignUp).toHaveAttribute('href', `#${Route.register}`);
    await expect(get(ArticlePage).commentForm).toBeHidden();
  });

  test('shows the empty comments hint on an article without comments', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(ArticlePage, Route.article(article.slug));

    await expect(get(ArticlePage).noComments).toHaveText('There are no comments yet...');
    await expect(get(ArticlePage).comments).toHaveCount(0);
  });

  test('author deletes own comment after the confirmation', async ({ get }) => {
    await get(Session).login();
    const { slug, comments } = await get(APIClient).api.comments.createOnNewArticle();
    const [comment] = comments;

    await get(ArticlePage, Route.article(slug));
    await expect(get(ArticlePage).comment(comment.body)).toBeVisible();
    const dialog = get(ArticlePage).confirmation.answerNext('accept');
    await get(ArticlePage).button.click(get(ArticlePage).commentDeleteButton(comment.body));

    expect(await dialog).toBe('Want to delete the comment?');
    await expect(get(ArticlePage).comment(comment.body)).toBeHidden();
    await expect(get(ArticlePage).noComments).toBeVisible();
    expect(await get(APIClient).get.comments.list(slug)).toHaveLength(0);
  });

  test('signed-in author sees the comment form instead of the prompt', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();
    await get(Session).login();

    await get(ArticlePage, Route.article(article.slug));

    await expect(get(ArticlePage).commentForm).toBeVisible();
    await expect(get(ArticlePage).commentPrompt).toBeHidden();
  });
});
