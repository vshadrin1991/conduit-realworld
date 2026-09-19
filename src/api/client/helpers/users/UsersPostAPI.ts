import type { LoginCredentials } from '@/api/request/users/LoginCredentials';
import type { NewUser } from '@/api/request/users/NewUser';
import type { User, UserResponse } from '@/api/responses/users/User';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class UsersPostAPI extends RestClient {
  /**
   * POST /users — registers a new user. Counts against the auth rate limit, so prefer
   * `getTestUser()`/`getOtherUser()` over registering in every test.
   * @param user - username, email and password
   * @return the created user with its token
   */
  async with(user: NewUser): Promise<User> {
    const request = { name: `register user :: ${user.username}`, path: BasePath.USERS, method: 'POST' as const };
    return (await this.json<UserResponse>({ ...request, body: { user }, statusCode: 201 })).user;
  }

  /**
   * POST /users/login — signs the user in and returns it with a fresh token. Counts against
   * the auth rate limit, so prefer `getTestUser()`/`getOtherUser()` over logging in per test.
   * @param credentials - email and password
   * @return the signed-in user with its token
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const request = { name: `login :: ${credentials.email}`, path: BasePath.USERS_LOGIN, method: 'POST' as const };
    return (await this.json<UserResponse>({ ...request, body: { user: credentials } })).user;
  }
}
