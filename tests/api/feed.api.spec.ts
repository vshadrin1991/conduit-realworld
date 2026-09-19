import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getOtherUser, getTestUser } from '@/api/client/session/auth/User';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import {
  AUTOMATION_TAGS,
  generateShortTestsName,
  generateTestsName,
  generateUser,
} from '@/utilities/tests/TestDataGenerator';

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

  test('answers an empty list for filters that match nothing', async ({ get }) => {
    const client = get(APIClient, { guest: true });
    const rows = [
      { tag: generateShortTestsName('tag') },
      { author: generateShortTestsName('user') },
      { author: generateShortTestsName('user'), tag: FEED_TAG },
    ];

    for (const params of rows) {
      const list = await client.get.articles.list(params);
      expect(list, JSON.stringify(params)).toMatchSchema(Schema.ARTICLES);
      expect(list.articles).toHaveLength(0);
      expect(list.articlesCount).toBe(0);
    }
  });

  test('combines the author and tag filters', async ({ get }) => {
    const tag = generateTestsName('tag');
    const [article] = await get(APIClient).api.articles.create({ tagList: [tag] });
    const client = get(APIClient, { guest: true });

    const match = await client.get.articles.list({ author: article.author.username, tag });
    expect(match.articles.map((entry) => entry.slug)).toContain(article.slug);

    const mismatch = await client.get.articles.list({
      author: article.author.username,
      tag: generateShortTestsName('tag'),
    });
    expect(mismatch.articles.map((entry) => entry.slug)).not.toContain(article.slug);
  });

  test('lists only the articles favorited by the given user', async ({ get }) => {
    const testUser = await getTestUser();
    const other = await getOtherUser();
    const [article] = await get(APIClient).api.articles.create();
    await get(APIClient).post.articles.favorite(article.slug);
    const client = get(APIClient, { guest: true });

    const mine = await client.get.articles.list({ favorited: testUser.username, limit: 50 });
    expect(mine.articles.map((entry) => entry.slug)).toContain(article.slug);
    expect(mine.articles.every((entry) => entry.favoritesCount > 0)).toBe(true);

    const others = await client.get.articles.list({ favorited: other.username, limit: 50 });
    expect(others.articles.map((entry) => entry.slug)).not.toContain(article.slug);
  });

  test.fail('rejects invalid pagination parameters (REQ-02.D1)', async ({ get }) => {
    const client = get(APIClient, { guest: true });

    const rows: Record<string, string | number>[] = [{ limit: -1 }, { limit: 'abc' }, { offset: -1 }];
    for (const params of rows) {
      const response = await client.response({
        name: `list articles with ${JSON.stringify(params)}`,
        path: BasePath.ARTICLES,
        params,
        statusCode: 0,
      });

      expect(response.status(), JSON.stringify(params)).toBe(422);
      const body = (await response.json()) as ErrorResponse;
      expect(body).toMatchSchema(Schema.ERROR);
    }
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

    await expect(response).toBeApiError('You need to login first!', 401);
  });

  test('lists only the articles of followed authors in the personal feed', async ({ get }) => {
    const author = await getTestUser();
    const reader = await get(APIClient, { guest: true }).post.users.with(generateUser());
    const created = await get(APIClient).api.articles.create({ count: 4 });

    const beforeFollow = await get(APIClient, { token: reader.token }).get.articles.feed();
    await get(APIClient, { token: reader.token }).post.profiles.follow(author.username);
    const feed = await get(APIClient, { token: reader.token }).get.articles.feed();
    await get(APIClient, { token: reader.token }).delete.profiles.unfollow(author.username);

    expect(beforeFollow.articlesCount).toBe(0);
    expect(feed).toMatchSchema(Schema.ARTICLES);
    expect(feed.articles).toHaveLength(PAGE_SIZE);
    expect(feed.articlesCount).toBeGreaterThanOrEqual(created.length);
    expect(feed.articles.every((article) => article.author.username === author.username)).toBe(true);
    const createdAt = feed.articles.map((article) => Date.parse(article.createdAt));
    expect(createdAt).toEqual([...createdAt].sort((first, second) => second - first));
  });

  test.fail('answers an unknown favorited username without a server error (REQ-02.D2)', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).response({
      name: 'list articles favorited by an unknown user',
      path: BasePath.ARTICLES,
      params: { favorited: generateShortTestsName('user') },
      statusCode: 0,
    });

    expect(response.status()).toBeLessThan(500);
  });
});
