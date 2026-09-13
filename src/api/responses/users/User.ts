export interface User {
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
  token: string;
}

export interface UserResponse {
  user: User;
}
