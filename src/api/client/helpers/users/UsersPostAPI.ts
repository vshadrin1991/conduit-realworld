import type { LoginCredentials } from '@/api/request/users/LoginCredentials';
import type { NewUser } from '@/api/request/users/NewUser';
import type { User, UserResponse } from '@/api/responses/users/User';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class UsersPostAPI extends RestClient {
  async with(user: NewUser): Promise<User> {
    const request = { name: `register user :: ${user.username}`, path: BasePath.USERS, method: 'POST' as const };
    return (await this.json<UserResponse>({ ...request, body: { user }, statusCode: 201 })).user;
  }

  async login(credentials: LoginCredentials): Promise<User> {
    const request = { name: `login :: ${credentials.email}`, path: BasePath.USERS_LOGIN, method: 'POST' as const };
    return (await this.json<UserResponse>({ ...request, body: { user: credentials } })).user;
  }
}
