import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesDeleteAPI } from './articles/ArticlesDeleteAPI';
import { CommentsDeleteAPI } from './comments/CommentsDeleteAPI';

/** DELETE endpoints grouped by domain: `client.delete.articles.by(slug)`. */
export class RestApiDeleteHelper {
  readonly articles: ArticlesDeleteAPI;
  readonly comments: CommentsDeleteAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesDeleteAPI(request, token);
    this.comments = new CommentsDeleteAPI(request, token);
  }
}
