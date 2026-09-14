import type { ArticleQuery } from '@/api/request/articles/ArticleQuery';
import type { Article, ArticleResponse, ArticlesResponse } from '@/api/responses/articles/Article';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class ArticlesGetAPI extends RestClient {
  list(query: ArticleQuery = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({ name: 'list articles', path: ConduitBasePath.ARTICLES, params: { ...query } });
  }

  feed(query: Pick<ArticleQuery, 'limit' | 'offset'> = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({ name: 'feed', path: ConduitBasePath.ARTICLES_FEED, params: { ...query } });
  }

  async bySlug(slug: string): Promise<Article> {
    const request = { name: `get article :: ${slug}`, path: ConduitBasePath.ARTICLE, pathData: [slug] };
    return (await this.json<ArticleResponse>(request)).article;
  }
}
