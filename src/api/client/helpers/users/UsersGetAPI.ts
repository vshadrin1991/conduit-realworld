import type { User, UserResponse } from '@/api/responses/users/User';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class UsersGetAPI extends RestClient {
  /** GET /user — the user the client is authenticated as. */
  async current(): Promise<User> {
    return (await this.json<UserResponse>({ name: 'current user', path: ConduitBasePath.USER })).user;
  }
}
