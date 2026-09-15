import {APIClient} from '@/api/client/APIClient';
import {BasePath} from '@/api/client/path/BasePath';
import {getTestUser} from '@/api/client/session/auth/User';
import type {ErrorResponse} from '@/api/responses/errors/ErrorResponse';
import {expect, test} from '@/base/BaseTest';
import {generateArticle} from '@/utilities/tests/TestDataGenerator';

test.describe('Articles API', () => {
    test('creates an article', async ({get}) => {
        const testUser = await getTestUser();
        const data = generateArticle();

        const article = await get(APIClient).post.articles.with(data);
        get(APIClient).api.articles.track(article.slug);

        expect(article).toMatchObject({
            title: data.title,
            description: data.description,
            body: data.body,
            favorited: false,
            favoritesCount: 0,
            author: {username: testUser.username},
        });
        expect(article.tagList.toSorted()).toEqual(data.tagList!.toSorted());
    });

    test('returns an article by slug to a guest', async ({get}) => {
        const [created] = await get(APIClient).api.articles.create();

        const article = await get(APIClient, {guest: true}).get.articles.bySlug(created.slug);

        expect(article).toMatchObject({slug: created.slug, title: created.title, body: created.body});
    });

    test('lists articles filtered by author', async ({get}) => {
        const testUser = await getTestUser();
        const [created] = await get(APIClient).api.articles.create();

        const {articles} = await get(APIClient, {guest: true}).get.articles.list({
            author: testUser.username,
            limit: 10,
        });

        expect(articles.map((a) => a.slug)).toContain(created.slug);
        expect(articles.every((a) => a.author.username === testUser.username)).toBe(true);
    });

    test('updates an article', async ({get}) => {
        const [created] = await get(APIClient).api.articles.create();
        const changes = {title: `${created.title} updated`, body: 'Updated body'};

        const article = await get(APIClient).put.articles.with(created.slug, changes);
        get(APIClient).api.articles.track(article.slug);

        expect(article).toMatchObject(changes);
    });

    test('deletes an article', async ({get}) => {
        const [created] = await get(APIClient).api.articles.create();

        await get(APIClient).delete.articles.by(created.slug);

        await get(APIClient, {guest: true}).response({
            name: 'deleted article',
            path: BasePath.ARTICLE,
            pathData: [created.slug],
            statusCode: 404,
        });
    });

    test('rejects article creation without a token', async ({get}) => {
        const response = await get(APIClient, {guest: true}).response({
            name: 'create article without token',
            path: BasePath.ARTICLES,
            method: 'POST',
            body: {article: generateArticle()},
            statusCode: 401,
        });

        const {errors} = (await response.json()) as ErrorResponse;
        expect(errors.body).toContain('You need to login first!');
    });

    test('requires a title', async ({get}) => {
        const {title: _omitted, ...withoutTitle} = generateArticle();

        const response = await get(APIClient).response({
            name: 'create article without title',
            path: BasePath.ARTICLES,
            method: 'POST',
            body: {article: withoutTitle},
            statusCode: 422,
        });

        const {errors} = (await response.json()) as ErrorResponse;
        expect(errors.body).toContain('A title is required');
    });
});
