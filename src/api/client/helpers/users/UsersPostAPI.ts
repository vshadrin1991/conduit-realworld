import type { LoginCredentials } from '@/api/request/users/LoginCredentials';
import type { NewUser } from '@/api/request/users/NewUser';
import type { User, UserResponse } from '@/api/responses/users/User';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

/** Both endpoints are rate limited on the server (~5 requests/hour per IP). */
export class UsersPostAPI extends RestClient {
  /** POST /users — registers a user. */
  async with(user: NewUser): Promise<User> {
    const request = { name: `register user :: ${user.username}`, path: ConduitBasePath.USERS, method: 'POST' as const };
    return (await this.json<UserResponse>({ ...request, body: { user }, statusCode: 201 })).user;
  }

  /** POST /users/login — logs in and returns the user with a fresh token. */
  async login(credentials: LoginCredentials): Promise<User> {
    const request = { name: `login :: ${credentials.email}`, path: ConduitBasePath.USERS_LOGIN, method: 'POST' as const };
    return (await this.json<UserResponse>({ ...request, body: { user: credentials } })).user;
  }
}
