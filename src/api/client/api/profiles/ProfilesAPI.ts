import type { APIClient } from '@/api/client/APIClient';
import type { Profile } from '@/api/responses/profiles/Profile';

export class ProfilesAPI {
  /**
   * @param client - REST client whose endpoint helpers (and token) the flows use
   */
  constructor(private readonly client: APIClient) {}

  /**
   * Brings the follow state of the client's user towards another user to the expected one; follows or unfollows
   * only when the current state differs.
   * @param username - user to follow or unfollow
   * @param following - expected state: `true` following, `false` not following
   * @return profile of the user in the expected state, with the current followers count
   */
  async ensureFollowing(username: string, following: boolean): Promise<Profile> {
    const profile = await this.client.get.profiles.byUsername(username);
    if (profile.following === following) return profile;
    return following ? this.client.post.profiles.follow(username) : this.client.delete.profiles.unfollow(username);
  }
}
