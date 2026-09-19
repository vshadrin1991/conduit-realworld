import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { Article, ArticleResponse } from '@/api/responses/articles/Article';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ArticlesPutAPI extends RestClient {
  /**
   * PUT /articles/:slug — updates an article.
   * A new title regenerates the slug; the server ignores `tagList` on update (REQ-03.I4).
   */
  async with(slug: string, changes: Partial<NewArticle>): Promise<Article> {
    const request = { name: `update article :: ${slug}`, path: BasePath.ARTICLE, pathData: [slug] };
    return (await this.json<ArticleResponse>({ ...request, method: 'PUT', body: { article: changes } })).article;
  }
}
