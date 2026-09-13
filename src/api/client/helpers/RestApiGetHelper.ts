import type { APIRequestContext } from '@playwright/test';
import type { Token } from '../RestClient';
import { ArticlesGetAPI } from './articles/ArticlesGetAPI';
import { CommentsGetAPI } from './comments/CommentsGetAPI';
import { ProfilesGetAPI } from './profiles/ProfilesGetAPI';
import { TagsGetAPI } from './tags/TagsGetAPI';
import { UsersGetAPI } from './users/UsersGetAPI';

/** GET endpoints grouped by domain: `client.get.articles.bySlug(slug)`. */
export class RestApiGetHelper {
  readonly articles: ArticlesGetAPI;
  readonly comments: CommentsGetAPI;
  readonly profiles: ProfilesGetAPI;
  readonly tags: TagsGetAPI;
  readonly users: UsersGetAPI;

  constructor(request: APIRequestContext, token?: Token) {
    this.articles = new ArticlesGetAPI(request, token);
    this.comments = new CommentsGetAPI(request, token);
    this.profiles = new ProfilesGetAPI(request, token);
    this.tags = new TagsGetAPI(request, token);
    this.users = new UsersGetAPI(request, token);
  }
}
