import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { Article, ArticleResponse } from '@/api/responses/articles/Article';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ArticlesPostAPI extends RestClient {
  /**
   * POST /articles — creates an article authored by the client user.
   * @param article - title, description, body and tags
   * @return the created article
   */
  async with(article: NewArticle): Promise<Article> {
    const request = { name: `create article :: ${article.title}`, path: BasePath.ARTICLES, method: 'POST' as const };
    return (await this.json<ArticleResponse>({ ...request, body: { article }, statusCode: 201 })).article;
  }

  /**
   * POST /articles/:slug/favorite — favorites the article as the client user.
   * @param slug - slug of the article
   * @return article with `favorited: true` and the updated `favoritesCount`
   */
  async favorite(slug: string): Promise<Article> {
    const request = { name: `favorite article :: ${slug}`, path: BasePath.ARTICLE_FAVORITE, pathData: [slug] };
    return (await this.json<ArticleResponse>({ ...request, method: 'POST', statusCode: [200, 201] })).article;
  }
}
