import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class CommentsDeleteAPI extends RestClient {
  /** DELETE /articles/:slug/comments/:id */
  async by(slug: string, commentId: number): Promise<void> {
    const request = { name: `delete comment :: ${commentId}`, path: ConduitBasePath.COMMENT, pathData: [slug, commentId] };
    await this.response({ ...request, method: 'DELETE', statusCode: [200, 204] });
  }
}
