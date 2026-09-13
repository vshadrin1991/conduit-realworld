import { ConduitRestClient } from '@/api/client/ConduitRestClient';
import { ConduitBasePath } from '@/api/client/path/ConduitBasePath';
import { getTestUser } from '@/api/client/session/auth/testUser';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import { AUTH_QUOTA, expect, test } from '@/base/BaseTest';
import { generateEmail, generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Users API', () => {
  test('returns the current user for a valid token', async ({ get }) => {
    const testUser = await getTestUser();

    const user = await get(ConduitRestClient).get.users.current();

    expect(user).toMatchObject({ username: testUser.username, email: testUser.email });
  });

  test('rejects the current user request without a token', async ({ get }) => {
    const response = await get(ConduitRestClient, { guest: true }).response({
      name: 'current user without token',
      path: ConduitBasePath.USER,
      statusCode: 401,
    });

    const { errors } = (await response.json()) as ErrorResponse;
    expect(errors.body).toContain('You need to login first!');
  });

  test('registers a new user', { tag: AUTH_QUOTA }, async ({ get }) => {
    const newUser = generateUser();

    const user = await get(ConduitRestClient, { guest: true }).post.users.with(newUser);

    expect(user).toMatchObject({ username: newUser.username, email: newUser.email });
    expect(user.token).toBeTruthy();
  });

  test('rejects login for an unknown email', { tag: AUTH_QUOTA }, async ({ get }) => {
    const response = await get(ConduitRestClient, { guest: true }).response({
      name: 'login with unknown email',
      path: ConduitBasePath.USERS_LOGIN,
      method: 'POST',
      body: { user: { email: generateEmail(), password: 'irrelevant' } },
      statusCode: 404,
    });

    const { errors } = (await response.json()) as ErrorResponse;
    expect(errors.body).toContain('Email not found sign in first');
  });
});
