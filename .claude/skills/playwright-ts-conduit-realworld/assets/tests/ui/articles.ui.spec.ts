import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { expect, test } from '@/base/BaseTest';
import { Session } from '@/pageObject/components/Session';
import { ArticlePage } from '@/pageObject/pages/ArticlePage';
import { EditorPage } from '@/pageObject/pages/EditorPage';
import { HomePage } from '@/pageObject/pages/HomePage';
import { Route } from '@/pageObject/pagePath/Routes';
import { generateArticle, generateComment } from '@/utilities/tests/TestDataGenerator';

test.describe('Articles UI', () => {
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
      .clickActionButton('submit')
      .next(ArticlePage)
      .waitUntilPageLoaded();

    get(APIClient).api.articles.track(get(ArticlePage).slug);
    await expect(get(ArticlePage).title).toHaveText(data.title);
    expect((await get(ArticlePage).text.getTexts(get(ArticlePage).tags)).toSorted()).toEqual(data.tagList!.toSorted());
    const article = await get(APIClient).get.articles.bySlug(get(ArticlePage).slug);
    expect(article).toMatchObject({ title: data.title, description: data.description, body: data.body });
  });

  test('article created via API opens from the global feed', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(HomePage, Route.home).clickActionButton('globalFeed');

    await get(HomePage).findArticleInFeed(article.title);
    await get(HomePage).button.click(get(HomePage).articleLink(article.title));

    await get(ArticlePage).waitUntilPageLoaded();
    await expect(get(ArticlePage).body).toContainText(article.body);
  });

  test('author deletes an article', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    await get(ArticlePage, Route.article(article.slug));
    const dialog = get(ArticlePage).confirmation.answerNext('accept');
    await get(ArticlePage).clickActionButton('deleteArticle');

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
