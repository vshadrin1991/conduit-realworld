import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getOtherUser, getTestUser } from '@/api/client/session/auth/User';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import { generateComment, generateShortTestsName } from '@/utilities/tests/TestDataGenerator';

test.describe('Comments API', () => {
  test('adds, lists and deletes a comment', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();
    const data = generateComment();

    const comment = await get(APIClient).post.comments.with(article.slug, data);
    expect(comment).toMatchSchema(Schema.COMMENT);
    expect(comment).toMatchObject({ body: data.body, author: { username: (await getTestUser()).username } });

    const comments = await get(APIClient).get.comments.list(article.slug);
    expect(comments).toMatchSchema(Schema.COMMENTS);
    expect(comments.map((c) => c.id)).toContain(comment.id);

    await get(APIClient).delete.comments.by(article.slug, comment.id);
    const afterDelete = await get(APIClient).get.comments.list(article.slug);
    expect(afterDelete.map((c) => c.id)).not.toContain(comment.id);
  });

  test('returns an empty list for an article without comments', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    const comments = await get(APIClient, { guest: true }).get.comments.list(article.slug);

    expect(comments).toMatchSchema(Schema.COMMENTS);
    expect(comments).toHaveLength(0);
  });

  test('lists comments to a guest without the author email', async ({ get }) => {
    const { slug } = await get(APIClient).api.comments.createOnNewArticle();

    const comments = await get(APIClient, { guest: true }).get.comments.list(slug);

    expect(comments).toMatchSchema(Schema.COMMENTS);
    expect(comments).toHaveLength(1);
    expect(comments[0].author).not.toHaveProperty('email');
  });

  test('rejects comments without a token, without a body and on unknown articles', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    const noToken = await get(APIClient, { guest: true }).response({
      name: 'comment without token',
      path: BasePath.COMMENTS,
      pathData: [article.slug],
      method: 'POST',
      body: { comment: generateComment() },
      statusCode: 401,
    });
    await expect(noToken).toBeApiError('You need to login first!', 401);

    const empty = await get(APIClient).response({
      name: 'empty comment',
      path: BasePath.COMMENTS,
      pathData: [article.slug],
      method: 'POST',
      body: { comment: { body: '' } },
      statusCode: 422,
    });
    await expect(empty).toBeApiError('Comment body is required', 422);

    const noBody = await get(APIClient).response({
      name: 'comment without a body field',
      path: BasePath.COMMENTS,
      pathData: [article.slug],
      method: 'POST',
      body: { comment: {} },
      statusCode: 422,
    });
    await expect(noBody).toBeApiError('Comment body is required', 422);

    const missing = await get(APIClient).response({
      name: 'comment on an unknown article',
      path: BasePath.COMMENTS,
      pathData: [generateShortTestsName('article')],
      method: 'POST',
      body: { comment: generateComment() },
      statusCode: 404,
    });
    await expect(missing).toBeApiError('Article not found', 404);
  });

  test('rejects deleting the comment of another user and unknown comment ids', async ({ get }) => {
    const other = await getOtherUser();
    const { slug, comments } = await get(APIClient).api.comments.createOnNewArticle();
    const [comment] = comments;

    const notAuthor = await get(APIClient, { token: other.token }).response({
      name: 'delete the comment of another user',
      path: BasePath.COMMENT,
      pathData: [slug, comment.id],
      method: 'DELETE',
      statusCode: 403,
    });
    await expect(notAuthor).toBeApiError('You are not the author of this comment', 403);

    const unknown = await get(APIClient).response({
      name: 'delete an unknown comment',
      path: BasePath.COMMENT,
      pathData: [slug, 999_999_999],
      method: 'DELETE',
      statusCode: 404,
    });
    await expect(unknown).toBeApiError('Comment not found', 404);

    const deleted = await get(APIClient).response({
      name: 'delete own comment',
      path: BasePath.COMMENT,
      pathData: [slug, comment.id],
      method: 'DELETE',
      statusCode: 200,
    });
    const body = (await deleted.json()) as { message?: { body?: string[] } };
    expect(body.message?.body).toContain('Comment deleted successfully');
    expect(await get(APIClient).get.comments.list(slug)).toHaveLength(0);

    const again = await get(APIClient).response({
      name: 'delete the same comment again',
      path: BasePath.COMMENT,
      pathData: [slug, comment.id],
      method: 'DELETE',
      statusCode: 404,
    });
    await expect(again).toBeApiError('Comment not found', 404);

    const badId = await get(APIClient).response({
      name: 'delete a comment with a malformed id',
      path: BasePath.COMMENT,
      pathData: [slug, 'abc'],
      method: 'DELETE',
      statusCode: 404,
    });
    await expect(badId).toBeApiError('Comment not found', 404);

    const unknownArticle = await get(APIClient).response({
      name: 'delete a comment on an unknown article',
      path: BasePath.COMMENT,
      pathData: [generateShortTestsName('article'), comment.id],
      method: 'DELETE',
      statusCode: 404,
    });
    await expect(unknownArticle).toBeApiError('Comment not found', 404);
  });

  test.fail('rejects deleting a comment through another article (REQ-04.D1)', async ({ get }) => {
    const { slug, comments } = await get(APIClient).api.comments.createOnNewArticle();
    const [otherArticle] = await get(APIClient).api.articles.create();
    const [comment] = comments;

    const response = await get(APIClient).response({
      name: 'delete the comment through another article',
      path: BasePath.COMMENT,
      pathData: [otherArticle.slug, comment.id],
      method: 'DELETE',
      statusCode: 0,
    });

    expect(response.status()).toBe(404);
    expect(await get(APIClient).get.comments.list(slug)).toHaveLength(1);
  });

  test.fail('responds with a validation error when the request has no comment wrapper (REQ-04.D2)', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    const response = await get(APIClient).response({
      name: 'comment without the comment key',
      path: BasePath.COMMENTS,
      pathData: [article.slug],
      method: 'POST',
      body: {},
      statusCode: 0,
    });

    expect(response.status()).toBe(422);
    const body = (await response.json()) as ErrorResponse;
    expect(body).toMatchSchema(Schema.ERROR);
  });
});
