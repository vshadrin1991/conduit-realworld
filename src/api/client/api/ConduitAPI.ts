import type { APIClient } from '../APIClient';
import { ArticlesAPI } from './articles/ArticlesAPI';
import { CommentsAPI } from './comments/CommentsAPI';

/**
 * High-level API: multi-call flows by domain on top of the endpoint helpers. Not obtained on its own —
 * it is the `api` group of the REST client: `get(APIClient).api.articles.create({ count: 2 })`.
 */
export class ConduitAPI {
  readonly articles: ArticlesAPI;
  readonly comments: CommentsAPI;

  /**
   * @param client - REST client whose endpoint helpers (and token) the flows use
   */
  constructor(client: APIClient) {
    this.articles = new ArticlesAPI(client);
    this.comments = new CommentsAPI(client);
  }
}
