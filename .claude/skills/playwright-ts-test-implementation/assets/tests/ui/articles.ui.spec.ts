// GOOD EXAMPLE — hybrid UI spec (API arrange → UI steps → UI + API assert).
// Location in the project: tests/ui/<feature>.ui.spec.ts. The tests of this file run one by one, each in its own
// new browser — no test relies on another.
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
  // beforeEach, never beforeAll: every test has its own new browser, and `get` needs a page that exists only in a test.
  test.beforeEach(async ({ get }) => {
    // Logged-in browser without the login form: no auth quota is spent.
    await get(Session).login();
  });

  test('user publishes an article from the editor', async ({ get }) => {
    const data = generateArticle();
    const tags = data.tagList!.join(',');

    // One chain = the user's steps, awaited once; each call is a report step located at its line.
    await get(EditorPage, Route.newArticle)
      .fillData('title', data.title)
      .fillData('description', data.description)
      .fillData('body', data.body)
      .fillData('tags', tags)
      .clickActionButton('submit');

    // Awaiting a chain resolves to void — take the cached page again to read its locators.
    const articlePage = get(ArticlePage);
    await articlePage.waitUntilPageLoaded();
    // Created through the UI, so no flow registered it: track it for cleanup right away.
    get(ConduitRestClient).api.articles.track(articlePage.slug);
    await expect(articlePage.title).toHaveText(data.title);
    expect((await articlePage.text.getTexts(articlePage.tags)).toSorted()).toEqual(data.tagList!.toSorted());
    // Verify persistence through the API, not only what the UI rendered.
    const article = await get(ConduitRestClient).get.articles.bySlug(articlePage.slug);
    expect(article).toMatchObject({ title: data.title, description: data.description, body: data.body });
  });

  test('article created via API opens from the global feed', async ({ get }) => {
    const [article] = await get(ConduitRestClient).api.articles.create();

    await get(HomePage, Route.home).clickActionButton('globalFeed');

    const homePage = get(HomePage);
    // Parallel tests publish too, so the article may not be on the first feed page.
    await homePage.findArticleInFeed(article.title);
    // A parametrised locator is not in the named maps: click it with the page's element helper.
    await homePage.button.click(homePage.articleLink(article.title));

    const articlePage = get(ArticlePage);
    await articlePage.waitUntilPageLoaded();
    await expect(articlePage.body).toContainText(article.body);
  });

  test('author deletes an article', async ({ get }) => {
    const [article] = await get(ConduitRestClient).api.articles.create();

    // Native confirm dialog: register the answer before the click that opens it.
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
