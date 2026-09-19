import type { Profile, ProfileResponse } from '@/api/responses/profiles/Profile';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ProfilesGetAPI extends RestClient {
  /**
   * GET /profiles/:username — returns the public profile of the user.
   * @param username - name of the user
   * @return profile of the user
   */
  async byUsername(username: string): Promise<Profile> {
    const request = { name: `get profile :: ${username}`, path: BasePath.PROFILE, pathData: [username] };
    return (await this.json<ProfileResponse>(request)).profile;
  }
}
