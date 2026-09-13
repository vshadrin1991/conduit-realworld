import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { Article, ArticleResponse } from '@/api/responses/articles/Article';
import { ConduitBasePath } from '../../path/ConduitBasePath';
import { RestClient } from '../../RestClient';

export class ArticlesPutAPI extends RestClient {
  /**
   * PUT /articles/:slug — updates an article.
   * A new title regenerates the slug, and an omitted `tagList` clears the tags.
   */
  async with(slug: string, changes: Partial<NewArticle>): Promise<Article> {
    const request = { name: `update article :: ${slug}`, path: ConduitBasePath.ARTICLE, pathData: [slug] };
    return (await this.json<ArticleResponse>({ ...request, method: 'PUT', body: { article: changes } })).article;
  }
}
