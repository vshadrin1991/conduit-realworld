import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getTestUser } from '@/api/client/session/auth/User';
import { AUTH_QUOTA, expect, test } from '@/base/BaseTest';
import { ArticlePage } from '@/pageObject/pages/ArticlePage';
import { EditorPage } from '@/pageObject/pages/EditorPage';
import { HomePage } from '@/pageObject/pages/HomePage';
import { LoginPage } from '@/pageObject/pages/LoginPage';
import { Route } from '@/pageObject/pagePath/Routes';
import { generateArticle, generateComment } from '@/utilities/tests/TestDataGenerator';

test.describe('Articles UI', { tag: AUTH_QUOTA }, () => {
  test.beforeEach(async ({ get }) => {
    const testUser = await getTestUser();

    await get(LoginPage, Route.login)
      .fillData('email', testUser.email)
      .fillData('password', testUser.password)
      .clickActionButton('login');

    await get(HomePage).waitUntilPageLoaded();
  });

  test('user publishes an article from the editor', async ({ get }) => {
    const data = generateArticle();
    const tags = data.tagList!.join(',');

    await get(EditorPage, Route.newArticle)
      .fillData('title', data.title)
      .fillData('description', data.description)
      .fillData('body', data.body)
      .fillData('tags', tags)
      .clickActionButton('submit');

    const articlePage = get(ArticlePage);
    await articlePage.waitUntilPageLoaded();
    get(APIClient).api.articles.track(articlePage.slug);
    await expect(articlePage.title).toHaveText(data.title);
    expect((await articlePage.text.getTexts(articlePage.tags)).toSorted()).toEqual(data.tagList!.toSorted());
    const article = await get(APIClient).get.articles.bySlug(articlePage.slug);
    expect(article).toMatchObject({ title: data.title, description: data.description, body: data.body });
  });

  test('article created via API opens from the global feed', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(HomePage, Route.home).clickActionButton('globalFeed');

    const homePage = get(HomePage);
    await homePage.findArticleInFeed(article.title);
    await homePage.button.click(homePage.articleLink(article.title));

    const articlePage = get(ArticlePage);
    await articlePage.waitUntilPageLoaded();
    await expect(articlePage.body).toContainText(article.body);
  });

  test('author deletes an article', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    const dialog = get(ArticlePage).confirmation.answerNext('accept');
    await get(ArticlePage, Route.article(article.slug)).clickActionButton('deleteArticle');

    expect(await dialog).toBe('Want to delete the article?');
    await get(HomePage).waitUntilPageLoaded();
    await get(APIClient, { guest: true }).response({
      name: 'deleted article',
      path: BasePath.ARTICLE,
      pathData: [article.slug],
      statusCode: 404,
    });
  });

  test('user adds a comment to an article', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();
    const { body: text } = generateComment();

    await get(ArticlePage, Route.article(article.slug)).fillData('comment', text).clickActionButton('postComment');

    await expect(get(ArticlePage).comment(text)).toBeVisible();
    const comments = await get(APIClient).get.comments.list(article.slug);
    expect(comments.map((comment) => comment.body)).toContain(text);
  });
});
