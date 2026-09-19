import type { Profile, ProfileResponse } from '@/api/responses/profiles/Profile';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ProfilesDeleteAPI extends RestClient {
  /**
   * DELETE /profiles/:username/follow — stops following the user and returns the updated profile.
   * @param username - name of the user to unfollow
   * @return profile with `following: false` and the updated `followersCount`
   */
  async unfollow(username: string): Promise<Profile> {
    const request = { name: `unfollow user :: ${username}`, path: BasePath.PROFILE_FOLLOW, pathData: [username] };
    return (await this.json<ProfileResponse>({ ...request, method: 'DELETE' })).profile;
  }
}
