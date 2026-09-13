import type { Profile } from '../profiles/Profile';

export interface Comment {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Profile;
}

export interface CommentResponse {
  comment: Comment;
}

export interface CommentsResponse {
  comments: Comment[];
}
