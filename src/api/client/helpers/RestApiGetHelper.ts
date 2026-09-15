import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesGetAPI } from './articles/ArticlesGetAPI';
import { CommentsGetAPI } from './comments/CommentsGetAPI';
import { TagsGetAPI } from './tags/TagsGetAPI';
import { UsersGetAPI } from './users/UsersGetAPI';

export class RestApiGetHelper {
  readonly articles: ArticlesGetAPI;
  readonly comments: CommentsGetAPI;
  readonly tags: TagsGetAPI;
  readonly users: UsersGetAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesGetAPI(request, token);
    this.comments = new CommentsGetAPI(request, token);
    this.tags = new TagsGetAPI(request, token);
    this.users = new UsersGetAPI(request, token);
  }
}
