import type { ConduitRestClient } from '@/api/client/ConduitRestClient';
import type { NewComment } from '@/api/request/comments/NewComment';
import type { Comment } from '@/api/responses/comments/Comment';
import { generateComment } from '@/utilities/tests/TestDataGenerator';

export class CommentsAPI {
  /**
   * @param client - REST client whose endpoint helpers (and token) the flows use
   */
  constructor(private readonly client: ConduitRestClient) {}

  /**
   * Adds generated comments to an article. Comments are removed with their article, which the
   * articles flow already cleans up, so nothing extra is tracked here.
   * @param slug - slug of the article to comment on
   * @param count - number of comments to add
   * @param overrides - fields to use instead of generated values
   * @return created comments in creation order
   */
  async create(slug: string, count = 1, overrides: Partial<NewComment> = {}): Promise<Comment[]> {
    const comments: Comment[] = [];
    for (let index = 0; index < count; index++) {
      comments.push(await this.client.post.comments.with(slug, generateComment(overrides)));
    }
    return comments;
  }

  /**
   * Creates a test article (registered for cleanup) with generated comments.
   * @param count - number of comments to add
   * @return slug of the article and its comments
   */
  async createOnNewArticle(count = 1): Promise<{ slug: string; comments: Comment[] }> {
    const [article] = await this.client.api.articles.create();
    return { slug: article.slug, comments: await this.create(article.slug, count) };
  }
}
