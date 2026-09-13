// GOOD EXAMPLE — request model. Location in the project: src/api/request/users/UpdateUser.ts
/** Body of `PUT /user` (wrapped as `{ user }`); every field is optional. */
export interface UpdateUser {
  email?: string;
  username?: string;
  password?: string;
  image?: string | null;
  bio?: string | null;
}
