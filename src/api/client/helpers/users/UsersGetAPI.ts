import type { User, UserResponse } from '@/api/responses/users/User';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class UsersGetAPI extends RestClient {
  async current(): Promise<User> {
    return (await this.json<UserResponse>({ name: 'current user', path: BasePath.USER })).user;
  }
}
