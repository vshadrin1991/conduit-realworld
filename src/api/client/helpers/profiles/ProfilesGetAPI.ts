import type { Profile, ProfileResponse } from '@/api/responses/profiles/Profile';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class ProfilesGetAPI extends RestClient {
  /** GET /profiles/:username */
  async by(username: string): Promise<Profile> {
    const request = { name: `get profile :: ${username}`, path: ConduitBasePath.PROFILE, pathData: [username] };
    return (await this.json<ProfileResponse>(request)).profile;
  }
}
