import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class CommentsDeleteAPI extends RestClient {
  /**
   * DELETE /articles/:slug/comments/:id — deletes a comment; only its author may delete it.
   * @param slug - slug of the article
   * @param commentId - id of the comment
   */
  async by(slug: string, commentId: number): Promise<void> {
    const request = { name: `delete comment :: ${commentId}`, path: BasePath.COMMENT, pathData: [slug, commentId] };
    await this.response({ ...request, method: 'DELETE', statusCode: [200, 204] });
  }
}
