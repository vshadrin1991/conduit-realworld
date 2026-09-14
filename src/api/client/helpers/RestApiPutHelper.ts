import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesPutAPI } from './articles/ArticlesPutAPI';

export class RestApiPutHelper {
  readonly articles: ArticlesPutAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesPutAPI(request, token);
  }
}
