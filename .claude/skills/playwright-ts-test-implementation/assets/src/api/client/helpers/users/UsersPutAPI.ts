// GOOD EXAMPLE — endpoint helper. Location in the project: src/api/client/helpers/users/UsersPutAPI.ts
// Register in RestApiPutHelper (`readonly users: UsersPutAPI;` + `this.users = new UsersPutAPI(request, token);`),
// then use it in tests: `await get(ConduitRestClient).put.users.with({ bio })`.
// Only for a user created by the test (tag AUTH_QUOTA) — never change the shared test user.
import { ConduitBasePath } from '@/api/client/path/ConduitBasePath';
import { RestClient } from '@/api/client/RestClient';
import type { UpdateUser } from '@/api/request/users/UpdateUser';
import type { User, UserResponse } from '@/api/responses/users/User';

/** PUT endpoints of the users domain. */
export class UsersPutAPI extends RestClient {
  /**
   * PUT /user — updates the user the client is authenticated as.
   * The backend answers 500 when only `bio` is sent, so send it together with another field.
   * @param changes - fields to update
   * @return updated user
   */
  async with(changes: UpdateUser): Promise<User> {
    const request = { name: 'update current user', path: ConduitBasePath.USER, method: 'PUT' as const };
    return (await this.json<UserResponse>({ ...request, body: { user: changes } })).user;
  }
}
