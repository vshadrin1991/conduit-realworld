import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getTestUser } from '@/api/client/session/auth/User';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { expect, test } from '@/base/BaseTest';
import { generateArticle } from '@/utilities/tests/TestDataGenerator';

test.describe('Articles API', () => {
  test('user favorites an article', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const article = await get(APIClient).post.articles.favorite(created.slug);

    expect(article).toMatchObject({ slug: created.slug, favorited: true, favoritesCount: 1 });
  });

  test('returns an article by slug to a guest', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const article = await get(APIClient, { guest: true }).get.articles.bySlug(created.slug);

    expect(article).toMatchObject({ slug: created.slug, title: created.title, body: created.body });
  });

  test('lists articles filtered by author', async ({ get }) => {
    const testUser = await getTestUser();
    const [created] = await get(APIClient).api.articles.create();

    const { articles } = await get(APIClient, { guest: true }).get.articles.list({
      author: testUser.username,
      limit: 10,
    });

    expect(articles.map((a) => a.slug)).toContain(created.slug);
    expect(articles.every((a) => a.author.username === testUser.username)).toBe(true);
  });

  test('updates an article title', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();
    const changes = { title: `${created.title} updated` };

    const article = await get(APIClient).put.articles.with(created.slug, changes);
    get(APIClient).api.articles.track(article.slug);

    expect(article).toMatchObject(changes);
  });

  test('guest cannot create an article', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).response({
      name: 'create article without token',
      path: BasePath.ARTICLES,
      method: 'POST',
      body: { article: generateArticle() },
      statusCode: 401,
    });

    const { errors } = (await response.json()) as ErrorResponse;
    expect(errors.body).toContain('You need to login first!');
  });
});
