import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { Article } from '@/api/responses/articles/Article';
import { createLogger } from '@/utilities/logger/logger';
import { generateArticle, generateComment } from '@/utilities/tests/TestDataGenerator';
import { getData, hasData, setData } from '@/utilities/tests/TestDataStorage';
import type { ConduitRestClient } from '../../ConduitRestClient';

const log = createLogger('ArticlesAPI');

export interface ArticlesData extends Partial<NewArticle> {
  count?: number;
}

export class ArticlesAPI {
  static readonly CREATED_ARTICLES = 'createdArticles';

  constructor(private readonly client: ConduitRestClient) {}

  async create({ count = 1, ...overrides }: ArticlesData = {}): Promise<Article[]> {
    const articles: Article[] = [];
    for (let index = 0; index < count; index++) {
      const article = await this.client.post.articles.with(generateArticle(overrides));
      this.track(article.slug);
      articles.push(article);
    }
    return articles;
  }

  async createWithComments(commentsCount: number, overrides: Partial<NewArticle> = {}): Promise<Article> {
    const [article] = await this.create(overrides);
    for (let index = 0; index < commentsCount; index++) {
      await this.client.post.comments.with(article.slug, generateComment());
    }
    return article;
  }

  track(slug: string): void {
    const slugs = hasData(ArticlesAPI.CREATED_ARTICLES) ? getData<string[]>(ArticlesAPI.CREATED_ARTICLES) : [];
    if (!slugs.includes(slug)) setData(ArticlesAPI.CREATED_ARTICLES, [...slugs, slug]);
  }

  async deleteCreated(): Promise<void> {
    if (!hasData(ArticlesAPI.CREATED_ARTICLES)) return;
    const slugs = getData<string[]>(ArticlesAPI.CREATED_ARTICLES);
    if (slugs.length) log.info(`Cleaning up ${slugs.length} article(s)`);
    for (const slug of slugs) {
      try {
        await this.client.delete.articles.by(slug, [200, 404]);
      } catch (error) {
        log.warn(`Cleanup failed for article "${slug}"`, error);
      }
    }
    setData(ArticlesAPI.CREATED_ARTICLES, []);
  }
}
