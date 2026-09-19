import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesDeleteAPI } from './articles/ArticlesDeleteAPI';
import { CommentsDeleteAPI } from './comments/CommentsDeleteAPI';
import { ProfilesDeleteAPI } from './profiles/ProfilesDeleteAPI';

export class RestApiDeleteHelper {
  readonly articles: ArticlesDeleteAPI;
  readonly comments: CommentsDeleteAPI;
  readonly profiles: ProfilesDeleteAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesDeleteAPI(request, token);
    this.comments = new CommentsDeleteAPI(request, token);
    this.profiles = new ProfilesDeleteAPI(request, token);
  }
}
