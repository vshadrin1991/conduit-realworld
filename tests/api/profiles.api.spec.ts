import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getTestUser } from '@/api/client/session/auth/User';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import { generateShortTestsName, generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Profiles API', () => {
  test('returns the public profile to a guest without the email', async ({ get }) => {
    const testUser = await getTestUser();

    const profile = await get(APIClient, { guest: true }).get.profiles.byUsername(testUser.username);

    expect(profile).toMatchSchema(Schema.PROFILE);
    expect(profile).toMatchObject({ username: testUser.username, following: false });
    expect(profile).not.toHaveProperty('email');
  });

  test('responds 404 for an unknown username', async ({ get }) => {
    const response = await get(APIClient, { guest: true }).response({
      name: 'profile of an unknown user',
      path: BasePath.PROFILE,
      pathData: [generateShortTestsName('user')],
      statusCode: 404,
    });

    await expect(response).toBeApiError('User profile not found', 404);
  });

  test('follows and unfollows a user updating following and followersCount', async ({ get }) => {
    const target = generateUser();
    await get(APIClient, { guest: true }).post.users.with(target);
    const client = get(APIClient);

    const followed = await client.post.profiles.follow(target.username);
    expect(followed).toMatchSchema(Schema.PROFILE);
    expect(followed).toMatchObject({
      username: target.username,
      following: true,
      followersCount: 1,
    });

    const followedAgain = await client.post.profiles.follow(target.username);
    expect(followedAgain).toMatchObject({ following: true, followersCount: 1 });

    const unfollowed = await client.delete.profiles.unfollow(target.username);
    expect(unfollowed).toMatchObject({
      username: target.username,
      following: false,
      followersCount: 0,
    });

    const unfollowedAgain = await client.delete.profiles.unfollow(target.username);
    expect(unfollowedAgain).toMatchObject({ following: false, followersCount: 0 });
  });

  test('rejects following without a token and unknown users', async ({ get }) => {
    const testUser = await getTestUser();

    const noToken = await get(APIClient, { guest: true }).response({
      name: 'follow without token',
      path: BasePath.PROFILE_FOLLOW,
      pathData: [testUser.username],
      method: 'POST',
      statusCode: 401,
    });
    await expect(noToken).toBeApiError('You need to login first!', 401);

    const missing = await get(APIClient).response({
      name: 'follow an unknown user',
      path: BasePath.PROFILE_FOLLOW,
      pathData: [generateShortTestsName('user')],
      method: 'POST',
      statusCode: 404,
    });
    await expect(missing).toBeApiError('User profile not found', 404);
  });
});

test.describe('Favorites API', () => {
  test('favorites and unfavorites an article updating favorited and favoritesCount', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    const favorited = await get(APIClient).post.articles.favorite(article.slug);
    expect(favorited).toMatchSchema(Schema.ARTICLE);
    expect(favorited).toMatchObject({ slug: article.slug, favorited: true, favoritesCount: 1 });

    const favoritedAgain = await get(APIClient).post.articles.favorite(article.slug);
    expect(favoritedAgain).toMatchObject({ favorited: true, favoritesCount: 1 });

    const unfavorited = await get(APIClient).delete.articles.unfavorite(article.slug);
    expect(unfavorited).toMatchObject({ slug: article.slug, favorited: false, favoritesCount: 0 });

    const unfavoritedAgain = await get(APIClient).delete.articles.unfavorite(article.slug);
    expect(unfavoritedAgain).toMatchObject({ favorited: false, favoritesCount: 0 });
  });

  test('rejects favoriting without a token and unknown articles', async ({ get }) => {
    const [article] = await get(APIClient).api.articles.create();

    const noToken = await get(APIClient, { guest: true }).response({
      name: 'favorite without token',
      path: BasePath.ARTICLE_FAVORITE,
      pathData: [article.slug],
      method: 'POST',
      statusCode: 401,
    });
    await expect(noToken).toBeApiError('You need to login first!', 401);

    const missing = await get(APIClient).response({
      name: 'favorite an unknown article',
      path: BasePath.ARTICLE_FAVORITE,
      pathData: [generateShortTestsName('article')],
      method: 'POST',
      statusCode: 404,
    });
    await expect(missing).toBeApiError('Article not found', 404);
  });
});
