import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getOtherUser, getTestUser } from '@/api/client/session/auth/User';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import type { UserResponse } from '@/api/responses/users/User';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import { generateEmail, generatePhrase, generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Users API', () => {
  test.describe('sign-up', () => {
    test.fail('registers a new user and returns the user with a token (REQ-01.D1)', async ({ get }) => {
      const newUser = generateUser();

      const user = await get(APIClient, { guest: true }).post.users.with(newUser);

      expect(user).toMatchSchema(Schema.USER);
      expect(user).toMatchObject({ username: newUser.username, email: newUser.email });
      expect(user.token).toBeTruthy();
      expect(user).toHaveProperty('bio');
      expect(user).toHaveProperty('image');
    });

    test('checks the required sign-up fields in order and creates no account', async ({ get }) => {
      const newUser = generateUser();
      const rows = [
        { name: 'no fields', user: {}, message: 'A username is required' },
        {
          name: 'no username',
          user: { email: newUser.email, password: newUser.password },
          message: 'A username is required',
        },
        {
          name: 'no email',
          user: { username: newUser.username, password: newUser.password },
          message: 'An email is required',
        },
        {
          name: 'no password',
          user: { username: newUser.username, email: newUser.email },
          message: 'A password is required',
        },
      ];

      for (const row of rows) {
        const response = await get(APIClient, { guest: true }).response({
          name: `register with ${row.name}`,
          path: BasePath.USERS,
          method: 'POST',
          body: { user: row.user },
          statusCode: 422,
        });

        await expect(response, `register with ${row.name}`).toBeApiError(row.message, 422);
      }

      const login = await get(APIClient, { guest: true }).response({
        name: 'login after the rejected sign-ups',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: newUser.email, password: newUser.password } },
        statusCode: 404,
      });
      await expect(login).toBeApiError('Email not found sign in first', 404);
    });

    test('rejects sign-up with an email that already exists', async ({ get }) => {
      const existing = await getTestUser();
      const duplicate = generateUser({ email: existing.email });

      const response = await get(APIClient, { guest: true }).response({
        name: 'register with an existing email',
        path: BasePath.USERS,
        method: 'POST',
        body: { user: duplicate },
        statusCode: 422,
      });

      await expect(response).toBeApiError('Email already exists.. try logging in', 422);
      const login = await get(APIClient, { guest: true }).response({
        name: 'login with the rejected password',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: existing.email, password: duplicate.password } },
        statusCode: 422,
      });
      await expect(login).toBeApiError('Wrong email/password combination', 422);
    });

    test.fail('rejects a sign-up request without the user wrapper (REQ-01.I2)', async ({ get }) => {
      const response = await get(APIClient, { guest: true }).response({
        name: 'register without the user key',
        path: BasePath.USERS,
        method: 'POST',
        body: {},
        statusCode: 0,
      });

      expect(response.status()).toBe(422);
      const body = (await response.json()) as ErrorResponse;
      expect(body).toMatchSchema(Schema.ERROR);
    });

    test('accepts sign-up with an existing username', async ({ get }) => {
      const accountA = generateUser();
      await get(APIClient, { guest: true }).post.users.with(accountA);
      const accountB = generateUser({ username: accountA.username });

      const user = await get(APIClient, { guest: true }).post.users.with(accountB);

      expect(user).toMatchObject({ username: accountA.username, email: accountB.email });
      const signedInB = await get(APIClient, { guest: true }).post.users.login(accountB);
      expect(signedInB).toMatchObject({ email: accountB.email });
    });
  });

  test.describe('sign-in', () => {
    test('returns a token for valid credentials', async ({ get }) => {
      const testUser = await getTestUser();

      const user = await get(APIClient, { guest: true }).post.users.login(testUser);

      expect(user).toMatchSchema(Schema.USER);
      expect(user).toMatchObject({ email: testUser.email, username: testUser.username });
      expect(user.token).toBeTruthy();
    });

    test('rejects login for an unknown email', async ({ get }) => {
      const response = await get(APIClient, { guest: true }).response({
        name: 'login with unknown email',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: generateEmail(), password: 'irrelevant' } },
        statusCode: 404,
      });

      await expect(response).toBeApiError('Email not found sign in first', 404);
    });

    test('rejects login with a wrong password', async ({ get }) => {
      const testUser = await getTestUser();

      const response = await get(APIClient, { guest: true }).response({
        name: 'login with a wrong password',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: testUser.email, password: `wrong-${generateUser().password}` } },
        statusCode: 422,
      });

      await expect(response).toBeApiError('Wrong email/password combination', 422);
      const body = (await response.json()) as { user?: { token?: string } };
      expect(body.user).toBeUndefined();
    });

    test.fail('rejects malformed sign-in bodies with a validation error (REQ-01.I2)', async ({ get }) => {
      const rows = [
        { name: 'no user wrapper', body: {} },
        { name: 'no credentials', body: { user: {} } },
      ];

      for (const row of rows) {
        const response = await get(APIClient, { guest: true }).response({
          name: `sign-in with ${row.name}`,
          path: BasePath.USERS_LOGIN,
          method: 'POST',
          body: row.body,
          statusCode: 0,
        });

        expect(response.status(), row.name).toBe(422);
        const body = (await response.json()) as ErrorResponse;
        expect(body).toMatchSchema(Schema.ERROR);
      }
    });

    test('new account can log in and read itself', async ({ get }) => {
      const newUser = generateUser();
      await get(APIClient, { guest: true }).post.users.with(newUser);

      const signedIn = await get(APIClient, { guest: true }).post.users.login(newUser);

      expect(signedIn).toMatchObject({ email: newUser.email, username: newUser.username });
      expect(signedIn.token).toBeTruthy();
      const current = await get(APIClient, { token: signedIn.token }).get.users.current();
      expect(current).toMatchSchema(Schema.USER);
      expect(current).toMatchObject({ email: newUser.email, username: newUser.username });
    });
  });

  test.describe('session', () => {
    test('returns the user that owns the token', async ({ get }) => {
      const accountA = await getTestUser();
      const accountB = generateUser();
      const registeredB = await get(APIClient, { guest: true }).post.users.with(accountB);

      const userA = await get(APIClient, { token: accountA.token }).get.users.current();
      const userB = await get(APIClient, { token: registeredB.token }).get.users.current();

      expect(userA).toMatchObject({ email: accountA.email, username: accountA.username });
      expect(userB).toMatchObject({ email: accountB.email, username: accountB.username });
    });

    test('rejects the current user request without a token', async ({ get }) => {
      const response = await get(APIClient, { guest: true }).response({
        name: 'current user without token',
        path: BasePath.USER,
        statusCode: 401,
      });

      await expect(response).toBeApiError('You need to login first!', 401);
    });

    test.fail('rejects a malformed token instead of answering a server error (REQ-01.I5)', async ({ get }) => {
      const rows = [
        { name: 'GET', method: 'GET' as const, body: undefined },
        { name: 'PUT', method: 'PUT' as const, body: { user: { bio: generatePhrase() } } },
      ];

      for (const row of rows) {
        const response = await get(APIClient, { guest: true }).response({
          name: `${row.name} current user with a malformed token`,
          path: BasePath.USER,
          method: row.method,
          body: row.body,
          headers: { Authorization: 'Token malformed.token.value' },
          statusCode: 0,
        });

        expect(response.status(), row.name).toBe(401);
        const body = (await response.json()) as ErrorResponse;
        expect(body).toMatchSchema(Schema.ERROR);
      }
    });

    test('accepts any scheme word in the Authorization header', async ({ get }) => {
      const testUser = await getTestUser();

      for (const scheme of ['Bearer', 'Foo']) {
        const response = await get(APIClient, { guest: true }).response({
          name: `current user with the "${scheme}" scheme`,
          path: BasePath.USER,
          headers: { Authorization: `${scheme} ${testUser.token}` },
        });

        const { user } = (await response.json()) as UserResponse;
        expect(user, scheme).toMatchSchema(Schema.USER);
        expect(user, scheme).toMatchObject({ email: testUser.email, username: testUser.username });
      }
    });
  });

  test.describe('settings', () => {
    test('updates the profile fields of the user', async ({ get }) => {
      const other = await getOtherUser();
      const changes = { bio: generatePhrase(), image: 'https://example.com/pwauto-avatar.png' };

      const user = await get(APIClient, { token: other.token }).put.users.with({
        email: other.email,
        ...changes,
        password: other.password,
      });

      expect(user).toMatchSchema(Schema.USER);
      expect(user).toMatchObject({ email: other.email, username: other.username, ...changes });
      const profile = await get(APIClient, { guest: true }).get.profiles.byUsername(other.username);
      expect(profile).toMatchObject(changes);
    });

    test('rejects the update without a token', async ({ get }) => {
      const response = await get(APIClient, { guest: true }).response({
        name: 'update user without token',
        path: BasePath.USER,
        method: 'PUT',
        body: { user: { bio: generatePhrase() } },
        statusCode: 401,
      });

      await expect(response).toBeApiError('You need to login first!', 401);
    });

    test.fail('keeps the current password when only bio is sent (REQ-05.D1)', async ({ get }) => {
      const other = await getOtherUser();

      const response = await get(APIClient, { token: other.token }).response({
        name: 'update only bio',
        path: BasePath.USER,
        method: 'PUT',
        body: { user: { bio: generatePhrase() } },
        statusCode: 0,
      });

      expect(response.status()).toBe(200);
    });
  });
});
