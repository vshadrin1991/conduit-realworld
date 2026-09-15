import type { APIRequestContext } from '@playwright/test';
import { ConduitAPI } from './api/ConduitAPI';
import { RestApiDeleteHelper } from './helpers/RestApiDeleteHelper';
import { RestApiGetHelper } from './helpers/RestApiGetHelper';
import { RestApiPostHelper } from './helpers/RestApiPostHelper';
import { RestApiPutHelper } from './helpers/RestApiPutHelper';
import { RestClient, type Token } from './RestClient';

/**
 * Conduit REST client — the single entry point for every API call in tests: endpoint helpers grouped by HTTP verb
 * and domain, multi-call flows in `api`, plus `response(request)` for any call.
 *
 * get(APIClient).post.articles.with(article)                     // happy path, returns the model
 * get(APIClient).api.articles.create({ count: 2 })               // flow, created data is deleted after the test
 * get(APIClient, { guest: true }).response({                     // negative case, returns the raw response
 *   path: BasePath.ARTICLES, method: 'POST', body: { article }, statusCode: 401,
 * })
 */
export class APIClient extends RestClient {
  readonly get: RestApiGetHelper;
  readonly post: RestApiPostHelper;
  readonly put: RestApiPutHelper;
  readonly delete: RestApiDeleteHelper;
  readonly api: ConduitAPI;

  constructor(request: APIRequestContext, token?: Token) {
    super(request, token);
    this.get = new RestApiGetHelper(request, token);
    this.post = new RestApiPostHelper(request, token);
    this.put = new RestApiPutHelper(request, token);
    this.delete = new RestApiDeleteHelper(request, token);
    this.api = new ConduitAPI(this);
  }
}
