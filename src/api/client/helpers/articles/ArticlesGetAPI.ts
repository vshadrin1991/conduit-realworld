import type { ArticleQuery } from '@/api/request/articles/ArticleQuery';
import type { Article, ArticleResponse, ArticlesResponse } from '@/api/responses/articles/Article';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ArticlesGetAPI extends RestClient {
  list(query: ArticleQuery = {}): Promise<ArticlesResponse> {
    return this.json<ArticlesResponse>({ name: 'list articles', path: BasePath.ARTICLES, params: { ...query } });
  }

  async bySlug(slug: string): Promise<Article> {
    const request = { name: `get article :: ${slug}`, path: BasePath.ARTICLE, pathData: [slug] };
    return (await this.json<ArticleResponse>(request)).article;
  }
}
