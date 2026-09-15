import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesPostAPI } from './articles/ArticlesPostAPI';
import { CommentsPostAPI } from './comments/CommentsPostAPI';
import { ProfilesPostAPI } from './profiles/ProfilesPostAPI';
import { UsersPostAPI } from './users/UsersPostAPI';

export class RestApiPostHelper {
  readonly articles: ArticlesPostAPI;
  readonly comments: CommentsPostAPI;
  readonly profiles: ProfilesPostAPI;
  readonly users: UsersPostAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesPostAPI(request, token);
    this.comments = new CommentsPostAPI(request, token);
    this.profiles = new ProfilesPostAPI(request, token);
    this.users = new UsersPostAPI(request, token);
  }
}
