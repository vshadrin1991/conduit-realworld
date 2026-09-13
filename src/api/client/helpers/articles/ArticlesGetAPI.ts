import type { ArticleQuery } from '@/api/request/articles/ArticleQuery';
import type { Article, ArticleResponse, ArticlesResponse } from '@/api/responses/articles/Article';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class ArticlesGetAPI extends RestClient {
  /** GET /articles — filtered and paginated list, newest first. */
  list(query: ArticleQuery = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({ name: 'list articles', path: ConduitBasePath.ARTICLES, params: { ...query } });
  }

  /** GET /articles/feed — articles of followed authors (authenticated clients only). */
  feed(query: Pick<ArticleQuery, 'limit' | 'offset'> = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({ name: 'feed', path: ConduitBasePath.ARTICLES_FEED, params: { ...query } });
  }

  /** GET /articles/:slug */
  async bySlug(slug: string): Promise<Article> {
    const request = { name: `get article :: ${slug}`, path: ConduitBasePath.ARTICLE, pathData: [slug] };
    return (await this.json<ArticleResponse>(request)).article;
  }
}
