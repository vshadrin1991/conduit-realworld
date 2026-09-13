import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesPostAPI } from './articles/ArticlesPostAPI';
import { CommentsPostAPI } from './comments/CommentsPostAPI';
import { UsersPostAPI } from './users/UsersPostAPI';

/** POST endpoints grouped by domain: `client.post.articles.with(article)`. */
export class RestApiPostHelper {
  readonly articles: ArticlesPostAPI;
  readonly comments: CommentsPostAPI;
  readonly users: UsersPostAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesPostAPI(request, token);
    this.comments = new CommentsPostAPI(request, token);
    this.users = new UsersPostAPI(request, token);
  }
}
