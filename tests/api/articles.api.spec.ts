import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getOtherUser, getTestUser } from '@/api/client/session/auth/User';
import type { ArticleResponse } from '@/api/responses/articles/Article';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import { generateArticle, generateShortTestsName, generateTestsName } from '@/utilities/tests/TestDataGenerator';

test.describe('Articles API', () => {
  test('creates an article', async ({ get }) => {
    const testUser = await getTestUser();
    const data = generateArticle();

    const article = await get(APIClient).post.articles.with(data);
    get(APIClient).api.articles.track(article.slug);

    expect(article).toMatchSchema(Schema.ARTICLE);
    expect(article).toMatchObject({
      title: data.title,
      description: data.description,
      body: data.body,
      favorited: false,
      favoritesCount: 0,
      author: { username: testUser.username },
    });
    expect(article.tagList.toSorted()).toEqual(data.tagList!.toSorted());
  });

  test('returns an article by slug to a guest', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const article = await get(APIClient, { guest: true }).get.articles.bySlug(created.slug);

    expect(article).toMatchSchema(Schema.ARTICLE);
    expect(article).toMatchObject({ slug: created.slug, title: created.title, body: created.body });
  });

  test('lists articles filtered by author', async ({ get }) => {
    const testUser = await getTestUser();
    const [created] = await get(APIClient).api.articles.create();

    const response = await get(APIClient, { guest: true }).get.articles.list({
      author: testUser.username,
      limit: 10,
    });

    expect(response).toMatchSchema(Schema.ARTICLES);
    expect(response.articles.map((a) => a.slug)).toContain(created.slug);
    expect(response.articles.every((a) => a.author.username === testUser.username)).toBe(true);
  });

  test('updates an article', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();
    const changes = { title: `${created.title} updated`, body: 'Updated body' };

    const article = await get(APIClient).put.articles.with(created.slug, changes);
    get(APIClient).api.articles.track(article.slug);

    expect(article).toMatchSchema(Schema.ARTICLE);
    expect(article).toMatchObject(changes);
  });

  test('deletes an article', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    await get(APIClient).delete.articles.by(created.slug);

    await get(APIClient, { guest: true }).response({
      name: 'deleted article',
      path: BasePath.ARTICLE,
      pathData: [created.slug],
      statusCode: 404,
    });
  });

  test('rejects article creation without a token', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).response({
      name: 'create article without token',
      path: BasePath.ARTICLES,
      method: 'POST',
      body: { article: generateArticle() },
      statusCode: 401,
    });

    await expect(response).toBeApiError('You need to login first!', 401);
  });

  test('checks the required article fields in order', async ({ get }) => {
    const data = generateArticle();
    const rows = [
      { name: 'no fields', article: {}, message: 'A title is required' },
      { name: 'no title', article: { description: data.description, body: data.body }, message: 'A title is required' },
      {
        name: 'empty title',
        article: { title: '', description: data.description, body: data.body },
        message: 'A title is required',
      },
      { name: 'no description', article: { title: data.title, body: data.body }, message: 'A description is required' },
      { name: 'no body', article: { title: data.title, description: data.description }, message: 'An article body is required' },
    ];

    for (const row of rows) {
      const response = await get(APIClient).response({
        name: `create article with ${row.name}`,
        path: BasePath.ARTICLES,
        method: 'POST',
        body: { article: row.article },
        statusCode: 422,
      });

      await expect(response, `create with ${row.name}`).toBeApiError(row.message, 422);
    }
  });

  test('rejects a title whose slug already exists', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const response = await get(APIClient).response({
      name: 'create article with a taken title',
      path: BasePath.ARTICLES,
      method: 'POST',
      body: { article: generateArticle({ title: created.title }) },
      statusCode: [201, 422],
    });

    if (response.ok()) {
      const { article } = (await response.json()) as ArticleResponse;
      get(APIClient).api.articles.track(article.slug);
    }
    await expect(response).toBeApiError('Title already exists..', 422);
  });

  test('updates only the sent fields and regenerates the slug from a new title', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const renamed = await get(APIClient).put.articles.with(created.slug, { body: 'Updated body' });
    expect(renamed).toMatchObject({ slug: created.slug, title: created.title, body: 'Updated body' });

    const newTitle = `${generateTestsName('Renamed')} Article!`;
    const updated = await get(APIClient).put.articles.with(created.slug, { title: newTitle });
    get(APIClient).api.articles.track(updated.slug);

    const expectedSlug = newTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    expect(updated.slug).toBe(expectedSlug);
    expect(updated).toMatchObject({ title: newTitle, body: 'Updated body' });
    await get(APIClient).response({
      name: 'article at the old slug',
      path: BasePath.ARTICLE,
      pathData: [created.slug],
      statusCode: 404,
    });
  });

  test('rejects updating and deleting without a token', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    for (const method of ['PUT', 'DELETE'] as const) {
      const response = await get(APIClient, { guest: true }).response({
        name: `${method} article without token`,
        path: BasePath.ARTICLE,
        pathData: [created.slug],
        method,
        statusCode: 401,
      });

      await expect(response, method).toBeApiError('You need to login first!', 401);
    }
  });

  test('rejects updates and deletes by a user who is not the author', async ({ get }) => {
    const other = await getOtherUser();
    const [created] = await get(APIClient).api.articles.create();
    const rows = [
      { method: 'PUT', body: { article: { title: `${generateTestsName('Hijacked')}` } } },
      { method: 'DELETE', body: undefined },
    ] as const;

    for (const row of rows) {
      const response = await get(APIClient, { token: other.token }).response({
        name: `${row.method} article of another author`,
        path: BasePath.ARTICLE,
        pathData: [created.slug],
        method: row.method,
        body: row.body,
        statusCode: 403,
      });

      await expect(response, row.method).toBeApiError('You are not the author of this article', 403);
    }
  });

  test('responds 404 for an unknown slug on read, update and delete', async ({ get }) => {
    const slug = generateShortTestsName('unknown');
    const rows = [
      { method: 'GET', slug, body: undefined },
      { method: 'PUT', slug, body: { article: { title: 'x' } } },
      { method: 'DELETE', slug, body: undefined },
      { method: 'GET', slug: '%$#@!', body: undefined },
    ] as const;

    for (const row of rows) {
      const response = await get(APIClient).response({
        name: `${row.method} unknown article`,
        path: BasePath.ARTICLE,
        pathData: [row.slug],
        method: row.method,
        body: row.body,
        statusCode: 404,
      });

      await expect(response, row.method).toBeApiError('Article not found', 404);
    }
  });

  test('accepts an update that repeats the current values and ignores an empty title', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();

    const same = await get(APIClient).put.articles.with(created.slug, { description: created.description });
    expect(same).toMatchObject({ slug: created.slug, title: created.title, description: created.description });

    const ignored = await get(APIClient).put.articles.with(created.slug, { title: '' });
    expect(ignored).toMatchObject({ slug: created.slug, title: created.title });

    const untagged = await get(APIClient).put.articles.with(created.slug, {
      tagList: [generateShortTestsName('tag')],
    });
    expect([...untagged.tagList].sort()).toEqual([...created.tagList].sort());
  });

  test.fail('rejects renaming to a title whose slug is taken (REQ-03.D2)', async ({ get }) => {
    const [first] = await get(APIClient).api.articles.create();
    const [second] = await get(APIClient).api.articles.create();

    const response = await get(APIClient).response({
      name: 'rename article to a taken title',
      path: BasePath.ARTICLE,
      pathData: [second.slug],
      method: 'PUT',
      body: { article: { title: first.title } },
      statusCode: 0,
    });
    if (response.ok()) {
      const { article } = (await response.json()) as ArticleResponse;
      get(APIClient).api.articles.track(article.slug);
      await get(APIClient).delete.articles.by(article.slug, [200, 404]);
    }

    expect(response.status()).toBe(422);
    const body = (await response.json()) as ErrorResponse;
    expect(body).toMatchSchema(Schema.ERROR);
  });

  test('frees the slug once the article is deleted', async ({ get }) => {
    const [created] = await get(APIClient).api.articles.create();
    await get(APIClient).delete.articles.by(created.slug);

    const again = await get(APIClient).response({
      name: 'delete the article again',
      path: BasePath.ARTICLE,
      pathData: [created.slug],
      method: 'DELETE',
      statusCode: 404,
    });
    await expect(again).toBeApiError('Article not found', 404);

    const [recreated] = await get(APIClient).api.articles.create({ title: created.title });
    expect(recreated.slug).toBe(created.slug);
  });

  test.fail('responds with a validation error when the create request has no article wrapper (REQ-03.D1)', async ({ get }) => {
    const response = await get(APIClient).response({
      name: 'create article without the article key',
      path: BasePath.ARTICLES,
      method: 'POST',
      body: {},
      statusCode: 0,
    });

    expect(response.status()).toBe(422);
    const body = (await response.json()) as ErrorResponse;
    expect(body).toMatchSchema(Schema.ERROR);
  });

  test.fail('creates an article without a tag list (REQ-03.I1)', async ({ get }) => {
    const { tagList: _tagList, ...article } = generateArticle();

    const created = await get(APIClient).post.articles.with(article);
    get(APIClient).api.articles.track(created.slug);

    expect(created).toMatchSchema(Schema.ARTICLE);
  });
});
