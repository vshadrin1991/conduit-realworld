import type { User, UserResponse } from '@/api/responses/users/User';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class UsersGetAPI extends RestClient {
  /**
   * GET /user — returns the user the client is authenticated as; requires a token.
   * @return the current user with its token
   */
  async current(): Promise<User> {
    return (await this.json<UserResponse>({ name: 'current user', path: BasePath.USER })).user;
  }
}
