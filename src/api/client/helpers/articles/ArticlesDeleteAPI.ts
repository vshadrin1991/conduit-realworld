import type { Article, ArticleResponse } from '@/api/responses/articles/Article';
import { envConfig } from '@/config/env.config';
import { isAutomationData } from '@/utilities/tests/TestDataGenerator';
import { BasePath } from '../../path/BasePath';
import { RestClient } from '../../RestClient';

export class ArticlesDeleteAPI extends RestClient {
  /**
   * DELETE /articles/:slug — only automation articles (slug contains the automation key) may be deleted,
   * because tests run against a shared server.
   */
  async by(slug: string, statusCode: number | number[] = 200): Promise<void> {
    if (!isAutomationData(slug)) {
      throw new Error(
        `Not an automation article '${slug}' (expected the automation key '${envConfig.automationKey}').`,
      );
    }
    const request = { name: `delete article :: ${slug}`, path: BasePath.ARTICLE, pathData: [slug] };
    await this.response({ ...request, method: 'DELETE', statusCode });
  }

  /**
   * DELETE /articles/:slug/favorite — removes the favorite of the client user and returns the updated article.
   * Not restricted to automation data: unfavoriting deletes no content.
   * @param slug - slug of the article to unfavorite
   * @return article with `favorited: false` and the updated `favoritesCount`
   */
  async unfavorite(slug: string): Promise<Article> {
    const request = { name: `unfavorite article :: ${slug}`, path: BasePath.ARTICLE_FAVORITE, pathData: [slug] };
    return (await this.json<ArticleResponse>({ ...request, method: 'DELETE' })).article;
  }
}
