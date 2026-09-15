export interface Profile {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
  followersCount?: number;
}

export interface ProfileResponse {
  profile: Profile;
}
