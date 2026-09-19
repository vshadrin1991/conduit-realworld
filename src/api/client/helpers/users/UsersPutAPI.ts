import { BasePath } from '@/api/client/path/BasePath';
import { RestClient } from '@/api/client/RestClient';
import type { UpdateUser } from '@/api/request/users/UpdateUser';
import type { User, UserResponse } from '@/api/responses/users/User';

export class UsersPutAPI extends RestClient {
  /**
   * PUT /user — updates the user the client is authenticated as.
   * The backend re-hashes the password on every update and answers 500 when `password` is
   * absent (REQ-05.D1), so always send the current `password` along.
   * @param changes - fields to update
   * @return updated user
   */
  async with(changes: UpdateUser): Promise<User> {
    const request = { name: 'update current user', path: BasePath.USER, method: 'PUT' as const };
    return (await this.json<UserResponse>({ ...request, body: { user: changes } })).user;
  }
}
