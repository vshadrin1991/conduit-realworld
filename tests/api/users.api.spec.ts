import { APIClient } from '@/api/client/APIClient';
import { BasePath } from '@/api/client/path/BasePath';
import { getTestUser } from '@/api/client/session/auth/User';
import type { ErrorResponse } from '@/api/responses/errors/ErrorResponse';
import type { UserResponse } from '@/api/responses/users/User';
import { Schema } from '@/api/schemas/Schema';
import { expect, test } from '@/base/BaseTest';
import { generateEmail, generateUser } from '@/utilities/tests/TestDataGenerator';

test.describe('Users API', () => {
  test.describe('sign-up', () => {
    test('registers a new user and returns the user with a token', async ({ get }) => {
      const newUser = generateUser();

      const user = await get(APIClient, { guest: true }).post.users.with(newUser);

      expect(user).toMatchSchema(Schema.USER);
      expect(user).toMatchObject({ username: newUser.username, email: newUser.email });
      expect(user.token).toBeTruthy();
      expect(user).toHaveProperty('bio');
      expect(user).toHaveProperty('image');
    });

    test('rejects sign-up without a username and creates no account', async ({ get }) => {
      const newUser = generateUser();

      const response = await get(APIClient, { guest: true }).response({
        name: 'register without a username',
        path: BasePath.USERS,
        method: 'POST',
        body: { user: { email: newUser.email, password: newUser.password } },
        statusCode: 422,
      });

      const body = (await response.json()) as ErrorResponse;
      expect(body).toMatchSchema(Schema.ERROR);
      expect(body.errors.body).toContain('A username is required');
      const login = await get(APIClient, { guest: true }).response({
        name: 'login after the rejected sign-up',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: newUser.email, password: newUser.password } },
        statusCode: 404,
      });
      expect(((await login.json()) as ErrorResponse).errors.body).toContain('Email not found sign in first');
    });

    test('rejects sign-up without an email', async ({ get }) => {
      const newUser = generateUser();

      const response = await get(APIClient, { guest: true }).response({
        name: 'register without an email',
        path: BasePath.USERS,
        method: 'POST',
        body: { user: { username: newUser.username, password: newUser.password } },
        statusCode: 422,
      });

      expect(((await response.json()) as ErrorResponse).errors.body).toContain('An email is required');
    });

    test('rejects sign-up without a password and creates no account', async ({ get }) => {
      const newUser = generateUser();

      const response = await get(APIClient, { guest: true }).response({
        name: 'register without a password',
        path: BasePath.USERS,
        method: 'POST',
        body: { user: { username: newUser.username, email: newUser.email } },
        statusCode: 422,
      });

      expect(((await response.json()) as ErrorResponse).errors.body).toContain('A password is required');
      const login = await get(APIClient, { guest: true }).response({
        name: 'login after the rejected sign-up',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: newUser.email, password: newUser.password } },
        statusCode: 404,
      });
      expect(((await login.json()) as ErrorResponse).errors.body).toContain('Email not found sign in first');
    });

    test('checks the required sign-up fields in order username, email, password', async ({ get }) => {
      const newUser = generateUser();
      const rows = [
        { name: 'no fields', user: {}, message: 'A username is required' },
        { name: 'a password only', user: { password: newUser.password }, message: 'A username is required' },
        { name: 'an email only', user: { email: newUser.email }, message: 'A username is required' },
        { name: 'a username only', user: { username: newUser.username }, message: 'An email is required' },
      ];

      for (const row of rows) {
        const response = await get(APIClient, { guest: true }).response({
          name: `register with ${row.name}`,
          path: BasePath.USERS,
          method: 'POST',
          body: { user: row.user },
          statusCode: 422,
        });

        const { errors } = (await response.json()) as ErrorResponse;
        expect(errors.body, `register with ${row.name}`).toContain(row.message);
      }
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

      expect(((await response.json()) as ErrorResponse).errors.body).toContain('Email already exists.. try logging in');
      const login = await get(APIClient, { guest: true }).response({
        name: 'login with the rejected password',
        path: BasePath.USERS_LOGIN,
        method: 'POST',
        body: { user: { email: existing.email, password: duplicate.password } },
        statusCode: 422,
      });
      expect(((await login.json()) as ErrorResponse).errors.body).toContain('Wrong email/password combination');
    });

    test('accepts sign-up with an existing username', async ({ get }) => {
      const accountA = generateUser();
      await get(APIClient, { guest: true }).post.users.with(accountA);
      const accountB = generateUser({ username: accountA.username });

      const user = await get(APIClient, { guest: true }).post.users.with(accountB);

      expect(user).toMatchObject({ username: accountA.username, email: accountB.email });
      const signedInA = await get(APIClient, { guest: true }).post.users.login(accountA);
      expect(signedInA).toMatchObject({ email: accountA.email });
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

      const { errors } = (await response.json()) as ErrorResponse;
      expect(errors.body).toContain('Email not found sign in first');
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

      const body = (await response.json()) as ErrorResponse & { user?: { token?: string } };
      expect(body.errors.body).toContain('Wrong email/password combination');
      expect(body.user).toBeUndefined();
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

      const { errors } = (await response.json()) as ErrorResponse;
      expect(errors.body).toContain('You need to login first!');
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
});
