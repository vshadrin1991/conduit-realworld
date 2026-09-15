import {APIClient} from '@/api/client/APIClient';
import {getTestUser} from '@/api/client/session/auth/User';
import {expect, test} from '@/base/BaseTest';
import {generateComment} from '@/utilities/tests/TestDataGenerator';

test.describe('Comments API', () => {
    test('adds, lists and deletes a comment', async ({get}) => {
        const [article] = await get(APIClient).api.articles.create();
        const data = generateComment();

        const comment = await get(APIClient).post.comments.with(article.slug, data);
        expect(comment).toMatchObject({body: data.body, author: {username: (await getTestUser()).username}});

        const comments = await get(APIClient).get.comments.list(article.slug);
        expect(comments.map((c) => c.id)).toContain(comment.id);

        await get(APIClient).delete.comments.by(article.slug, comment.id);
        const afterDelete = await get(APIClient).get.comments.list(article.slug);
        expect(afterDelete.map((c) => c.id)).not.toContain(comment.id);
    });
});
