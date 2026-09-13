import type { NewArticle } from '@/api/request/articles/NewArticle';
import type { Article } from '@/api/responses/articles/Article';
import { createLogger } from '@/utilities/logger/logger';
import { generateArticle, generateComment } from '@/utilities/tests/TestDataGenerator';
import { getData, hasData, setData } from '@/utilities/tests/TestDataStorage';
import type { ConduitRestClient } from '../../ConduitRestClient';

const log = createLogger('ArticlesAPI');

export interface ArticlesData extends Partial<NewArticle> {
  /** Number of articles to create; each gets a generated title unless `title` is given. */
  count?: number;
}

/** Article flows composed from several endpoint calls. Created articles are deleted after the test. */
export class ArticlesAPI {
  /** TestDataStorage key with the slugs to delete after the test. */
  static readonly CREATED_ARTICLES = 'createdArticles';

  constructor(private readonly client: ConduitRestClient) {}

  /** Creates test articles and returns them in creation order. */
  async create({ count = 1, ...overrides }: ArticlesData = {}): Promise<Article[]> {
    const articles: Article[] = [];
    for (let index = 0; index < count; index++) {
      const article = await this.client.post.articles.with(generateArticle(overrides));
      this.track(article.slug);
      articles.push(article);
    }
    return articles;
  }

  /** Creates a test article with `commentsCount` generated comments and returns the article. */
  async createWithComments(commentsCount: number, overrides: Partial<NewArticle> = {}): Promise<Article> {
    const [article] = await this.create(overrides);
    for (let index = 0; index < commentsCount; index++) {
      await this.client.post.comments.with(article.slug, generateComment());
    }
    return article;
  }

  /** Registers an article created another way (UI, direct endpoint call, new slug after update) for deletion. */
  track(slug: string): void {
    const slugs = hasData(ArticlesAPI.CREATED_ARTICLES) ? getData<string[]>(ArticlesAPI.CREATED_ARTICLES) : [];
    if (!slugs.includes(slug)) setData(ArticlesAPI.CREATED_ARTICLES, [...slugs, slug]);
  }

  /** Deletes the registered articles (404 = the test already deleted it). Called by BaseTest after each test. */
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
