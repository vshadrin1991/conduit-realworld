import type { NewComment } from '@/api/request/comments/NewComment';
import type { Comment, CommentResponse } from '@/api/responses/comments/Comment';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class CommentsPostAPI extends RestClient {
  /** POST /articles/:slug/comments — adds a comment to an article. */
  async with(slug: string, comment: NewComment): Promise<Comment> {
    const request = { name: `add comment :: ${slug}`, path: ConduitBasePath.COMMENTS, pathData: [slug] };
    return (await this.json<CommentResponse>({ ...request, method: 'POST', body: { comment }, statusCode: 201 })).comment;
  }
}
