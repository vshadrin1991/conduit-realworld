import type { ConduitRestClient } from '../ConduitRestClient';
import { ArticlesAPI } from './articles/ArticlesAPI';

/**
 * High-level API: multi-call flows by domain on top of the endpoint helpers. Not obtained on its own —
 * it is the `api` group of the REST client: `get(ConduitRestClient).api.articles.create({ count: 2 })`.
 */
export class ConduitAPI {
  readonly articles: ArticlesAPI;

  /**
   * @param client - REST client whose endpoint helpers (and token) the flows use
   */
  constructor(client: ConduitRestClient) {
    this.articles = new ArticlesAPI(client);
  }
}
