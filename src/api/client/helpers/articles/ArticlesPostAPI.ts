import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { Article, ArticleResponse } from '@/api/responses/articles/Article';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ArticlesPostAPI extends RestClient {
  async with(article: NewArticle): Promise<Article> {
    const request = { name: `create article :: ${article.title}`, path: BasePath.ARTICLES, method: 'POST' as const };
    return (await this.json<ArticleResponse>({ ...request, body: { article }, statusCode: 201 })).article;
  }

  async favorite(slug: string): Promise<Article> {
    const request = { name: `favorite article :: ${slug}`, path: BasePath.ARTICLE_FAVORITE, pathData: [slug] };
    return (await this.json<ArticleResponse>({ ...request, method: 'POST', statusCode: [200, 201] })).article;
  }
}
