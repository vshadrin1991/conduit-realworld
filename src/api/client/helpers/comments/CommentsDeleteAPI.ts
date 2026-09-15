import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class CommentsDeleteAPI extends RestClient {
  async by(slug: string, commentId: number): Promise<void> {
    const request = { name: `delete comment :: ${commentId}`, path: BasePath.COMMENT, pathData: [slug, commentId] };
    await this.response({ ...request, method: 'DELETE', statusCode: [200, 204] });
  }
}
