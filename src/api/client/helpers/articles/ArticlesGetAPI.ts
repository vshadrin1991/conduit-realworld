import type { ArticleQuery } from '@/api/request/articles/ArticleQuery';
import type { Article, ArticleResponse, ArticlesResponse } from '@/api/responses/articles/Article';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ArticlesGetAPI extends RestClient {
  /**
   * GET /articles — the global list, filtered and paginated by the query.
   * @param query - `author`, `favorited`, `tag`, `limit`, `offset` filters
   * @return page of articles and the total count
   */
  list(query: ArticleQuery = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({ name: 'list articles', path: BasePath.ARTICLES, params: { ...query } });
  }

  /**
   * GET /articles/feed — articles of the authors the client user follows; requires a token.
   * @param query - `limit`, `offset` pagination
   * @return page of feed articles and the total count
   */
  feed(query: ArticleQuery = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({
      name: 'list feed articles',
      path: BasePath.ARTICLES_FEED,
      params: { ...query },
    });
  }

  /**
   * GET /articles/:slug — returns the article; public.
   * @param slug - slug of the article
   * @return the article
   */
  async bySlug(slug: string): Promise<Article> {
    const request = { name: `get article :: ${slug}`, path: BasePath.ARTICLE, pathData: [slug] };
    return (await this.json<ArticleResponse>(request)).article;
  }
}
