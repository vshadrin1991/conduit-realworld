import type { Comment, CommentsResponse } from '@/api/responses/comments/Comment';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class CommentsGetAPI extends RestClient {
  /** GET /articles/:slug/comments */
  async list(slug: string): Promise<Comment[]> {
    const request = { name: `list comments :: ${slug}`, path: ConduitBasePath.COMMENTS, pathData: [slug] };
    return (await this.json<CommentsResponse>(request)).comments;
  }
}
