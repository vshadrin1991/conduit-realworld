import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getTestUser } from '@/api/client/session/auth/User';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import { AUTOMATION_TAGS, generateShortTestsName, generateUser } from '@/utilities/tests/TestDataGenerator';

const [FEED_TAG] = AUTOMATION_TAGS;
const PAGE_SIZE = 3;

test.describe('Home feed API', () => {
  test('returns the documented article list to a guest', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).get.articles.list({ limit: PAGE_SIZE });

    expect(response).toMatchSchema(Schema.ARTICLES);
    expect(response.articles).toHaveLength(PAGE_SIZE);
    expect(response.articlesCount).toBeGreaterThan(PAGE_SIZE);
  });

  test('lists articles newest first', async ({ get }) => {
    const { articles } = await get(APIClient, { guest: true }).get.articles.list({ limit: 10 });

    const createdAt = articles.map((article) => Date.parse(article.createdAt));
    expect(articles.length).toBeGreaterThan(1);
    expect(createdAt).toEqual([...createdAt].sort((first, second) => second - first));
  });

  test('applies the default limit and offset', async ({ get }) => {
    const explicit = await get(APIClient, { guest: true }).get.articles.list({ limit: PAGE_SIZE, offset: 0 });

    const defaults = await get(APIClient, { guest: true }).get.articles.list();

    expect(defaults.articles).toHaveLength(PAGE_SIZE);
    expect(Date.parse(defaults.articles[0].createdAt)).toBeGreaterThanOrEqual(
      Date.parse(explicit.articles[0].createdAt),
    );
  });

  test('counts every matching article, not the returned page', async ({ get }) => {
    const page = await get(APIClient, { guest: true }).get.articles.list({ limit: PAGE_SIZE });
    const single = await get(APIClient, { guest: true }).get.articles.list({ limit: 1 });

    expect(page.articles).toHaveLength(PAGE_SIZE);
    expect(single.articles).toHaveLength(1);
    expect(page.articlesCount).toBeGreaterThan(page.articles.length);
    expect(single.articlesCount).toBeGreaterThan(single.articles.length);
  });

  test('filters articles by tag', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const { articles } = await get(APIClient, { guest: true }).get.articles.list({ tag: FEED_TAG, limit: 10 });

    expect(articles.map((article) => article.slug)).toContain(created.slug);
    expect(articles.every((article) => article.tagList.includes(FEED_TAG))).toBe(true);
  });

  test('reports favorited and following as false for a guest', async ({ get }) => {
    const { articles } = await get(APIClient, { guest: true }).get.articles.list({ limit: 5 });

    expect(articles.length).toBeGreaterThan(0);
    expect(articles.every((article) => !article.favorited)).toBe(true);
    expect(articles.every((article) => !article.author.following)).toBe(true);
  });

  test('returns the stored tags to a guest', async ({ get }) => {
    await get(APIClient).api.articles.create();

    const tags = await get(APIClient, { guest: true }).get.tags.list();

    expect(tags).toMatchSchema(Schema.TAGS);
    expect(tags).toContain(FEED_TAG);
  });

  test('rejects the personal feed without a token', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).response({
      name: 'personal feed without token',
      path: BasePath.ARTICLES_FEED,
      statusCode: 401,
    });

    const body = (await response.json()) as ErrorResponse;
    expect(body).toMatchSchema(Schema.ERROR);
    expect(body.errors.body).toContain('You need to login first!');
  });

  test('lists only the articles of followed authors in the personal feed', async ({ get }) => {
    const author = await getTestUser();
    const reader = await get(APIClient, { guest: true }).post.users.with(generateUser());
    const created = await get(APIClient).api.articles.create({ count: 4 });

    const beforeFollow = await get(APIClient, { token: reader.token }).get.articles.feed();
    const feed = await get(APIClient, { token: reader.token }).get.articles.feed();

    expect(beforeFollow.articlesCount).toBe(0);
    expect(feed).toMatchSchema(Schema.ARTICLES);
    expect(feed.articles).toHaveLength(PAGE_SIZE);
    expect(feed.articlesCount).toBeGreaterThanOrEqual(created.length);
    expect(feed.articles.every((article) => article.author.username === author.username)).toBe(true);
    const createdAt = feed.articles.map((article) => Date.parse(article.createdAt));
    expect(createdAt).toEqual([...createdAt].sort((first, second) => second - first));
  });

  test.fail('answers an unknown favorited username without a server error', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).response({
      name: 'list articles favorited by an unknown user',
      path: BasePath.ARTICLES,
      params: { favorited: generateShortTestsName('user') },
      statusCode: 0,
    });

    expect(response.status()).toBeLessThan(500);
  });
});
