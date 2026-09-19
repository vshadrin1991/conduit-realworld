import type { Profile, ProfileResponse } from '@/api/responses/profiles/Profile';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ProfilesPostAPI extends RestClient {
  /**
   * POST /profiles/:username/follow — follows the user as the client user.
   * @param username - name of the user to follow
   * @return profile with `following: true` and the updated `followersCount`
   */
  async follow(username: string): Promise<Profile> {
    const request = { name: `follow user :: ${username}`, path: BasePath.PROFILE_FOLLOW, pathData: [username] };
    return (await this.json<ProfileResponse>({ ...request, method: 'POST' as const })).profile;
  }
}
