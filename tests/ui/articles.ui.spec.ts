import { ConduitRestClient } from '@/api/client/ConduitRestClient';
import { ConduitBasePath } from '@/api/client/path/ConduitBasePath';
import { expect, test } from '@/base/BaseTest';
import { Confirmation } from '@/pageObject/components/Confirmation';
import { Session } from '@/pageObject/components/Session';
import { ArticlePage } from '@/pageObject/pages/ArticlePage';
import { EditorPage } from '@/pageObject/pages/EditorPage';
import { HomePage } from '@/pageObject/pages/HomePage';
import { Route } from '@/pageObject/routes';
import { generateArticle, generateComment } from '@/utilities/tests/TestDataGenerator';

test.describe('Articles UI', () => {
  // beforeEach, not beforeAll: every test runs in its own new browser, so each one needs its own session.
  test.beforeEach(async ({ get }) => {
    await get(Session).login();
  });

  test('user publishes an article from the editor', async ({ get }) => {
    const data = generateArticle();
    const tags = data.tagList!.join(',');

    await get(EditorPage, Route.newArticle)
      .fillData('title', data.title)
      .fillData('description', data.description)
      .fillData('body', data.body)
      .fillData('tags', tags)
      .verifyFieldData('tags', tags)
      .clickActionButton('submit');

    const articlePage = get(ArticlePage);
    await articlePage.waitUntilPageLoaded();
    get(ConduitRestClient).api.articles.track(articlePage.slug);
    await expect(articlePage.title).toHaveText(data.title);
    await expect(articlePage.body).toContainText(data.body);
    expect((await articlePage.text.getTexts(articlePage.tags)).toSorted()).toEqual(data.tagList!.toSorted());
    // Verify persistence through the API, not only what the UI rendered.
    const article = await get(ConduitRestClient).get.articles.bySlug(articlePage.slug);
    expect(article).toMatchObject({ title: data.title, description: data.description, body: data.body });
  });

  test('article created via API is shown in the global feed', async ({ get }) => {
    const [article] = await get(ConduitRestClient).api.articles.create();

    await get(HomePage, Route.home).clickActionButton('globalFeed');

    const homePage = get(HomePage);
    await expect(homePage.articlePreviews.first()).toBeVisible();
    const preview = await homePage.findArticleInFeed(article.title);
    await expect(preview).toContainText(article.description);
    await homePage.button.click(homePage.articleLink(article.title));

    const articlePage = get(ArticlePage);
    await articlePage.waitUntilPageLoaded();
    await expect(articlePage.title).toHaveText(article.title);
    await expect(articlePage.body).toContainText(article.body);
  });

  test('author deletes an article', async ({ get }) => {
    const [article] = await get(ConduitRestClient).api.articles.create();

    const dialog = get(Confirmation).answerNext('accept');
    await get(ArticlePage, Route.article(article.slug)).clickActionButton('deleteArticle');

    expect(await dialog).toBe('Want to delete the article?');
    await get(HomePage).waitUntilPageLoaded();
    await get(ConduitRestClient, { guest: true }).response({
      name: 'deleted article',
      path: ConduitBasePath.ARTICLE,
      pathData: [article.slug],
      statusCode: 404,
    });
  });

  test('user adds a comment to an article', async ({ get }) => {
    const [article] = await get(ConduitRestClient).api.articles.create();
    const { body: text } = generateComment();

    await get(ArticlePage, Route.article(article.slug))
      .fillData('comment', text)
      .clickActionButton('postComment');

    await expect(get(ArticlePage).comment(text)).toBeVisible();
    const comments = await get(ConduitRestClient).get.comments.list(article.slug);
    expect(comments.map((comment) => comment.body)).toContain(text);
  });
});
