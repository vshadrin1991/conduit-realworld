import type { Comment, CommentsResponse } from '@/api/responses/comments/Comment';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class CommentsGetAPI extends RestClient {
  async list(slug: string): Promise<Comment[]> {
    const request = { name: `list comments :: ${slug}`, path: BasePath.COMMENTS, pathData: [slug] };
    return (await this.json<CommentsResponse>(request)).comments;
  }
}
