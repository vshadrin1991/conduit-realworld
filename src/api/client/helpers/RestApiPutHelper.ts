import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesPutAPI } from './articles/ArticlesPutAPI';
import { UsersPutAPI } from './users/UsersPutAPI';

export class RestApiPutHelper {
  readonly articles: ArticlesPutAPI;
  readonly users: UsersPutAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesPutAPI(request, token);
    this.users = new UsersPutAPI(request, token);
  }
}
