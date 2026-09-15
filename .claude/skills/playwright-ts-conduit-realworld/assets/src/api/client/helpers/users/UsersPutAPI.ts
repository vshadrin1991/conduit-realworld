import { BasePath } from '@/api/client/path/BasePath';
import { RestClient } from '@/api/client/RestClient';
import type { UpdateUser } from '@/api/request/users/UpdateUser';
import type { User, UserResponse } from '@/api/responses/users/User';

export class UsersPutAPI extends RestClient {
  /**
   * PUT /user — updates the user the client is authenticated as.
   * The backend answers 500 when only `bio` is sent, so send it together with another field.
   * @param changes - fields to update
   * @return updated user
   */
  async with(changes: UpdateUser): Promise<User> {
    const request = { name: 'update current user', path: BasePath.USER, method: 'PUT' as const };
    return (await this.json<UserResponse>({ ...request, body: { user: changes } })).user;
  }
}
