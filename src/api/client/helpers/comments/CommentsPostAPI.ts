import type { NewComment } from '@/api/request/comments/NewComment';
import type { Comment, CommentResponse } from '@/api/responses/comments/Comment';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class CommentsPostAPI extends RestClient {
  async with(slug: string, comment: NewComment): Promise<Comment> {
    const request = { name: `add comment :: ${slug}`, path: BasePath.COMMENTS, pathData: [slug] };
    return (await this.json<CommentResponse>({ ...request, method: 'POST', body: { comment }, statusCode: 201 }))
      .comment;
  }
}
