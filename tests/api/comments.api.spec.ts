import { ConduitRestClient } from '@/api/client/ConduitRestClient';
import { getTestUser } from '@/api/client/session/auth/testUser';
import { expect, test } from '@/base/BaseTest';
import { generateComment } from '@/utilities/tests/TestDataGenerator';

test.describe('Comments API', () => {
  test('adds, lists and deletes a comment', async ({ get }) => {
    const [article] = await get(ConduitRestClient).api.articles.create();
    const data = generateComment();

    const comment = await get(ConduitRestClient).post.comments.with(article.slug, data);
    expect(comment).toMatchObject({ body: data.body, author: { username: (await getTestUser()).username } });

    const comments = await get(ConduitRestClient).get.comments.list(article.slug);
    expect(comments.map((c) => c.id)).toContain(comment.id);

    await get(ConduitRestClient).delete.comments.by(article.slug, comment.id);
    const afterDelete = await get(ConduitRestClient).get.comments.list(article.slug);
    expect(afterDelete.map((c) => c.id)).not.toContain(comment.id);
  });
});
