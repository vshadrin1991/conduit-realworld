import fs from 'node:fs';
import {
  test as base,
  expect as baseExpect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
  type TestInfo,
  type Video,
} from '@playwright/test';
import { APIClient } from '@/api/client/APIClient';
import { ArticlesAPI } from '@/api/client/api/articles/ArticlesAPI';
import type { RestClient, Token } from '@/api/client/RestClient';
import { schemaMatchers } from '@/api/schemas/SchemaMatcher';
import { getTestUser } from '@/api/client/session/auth/User';
import { envConfig } from '@/config/env.config';
import { createLogger, drainTestLogs } from '@/utilities/logger/Logger';
import { Interceptor } from '@/utilities/interceptor/Interceptor';
import { clearDataStorage, hasData } from '@/utilities/tests/TestDataStorage';
import { Tag } from '@/utilities/tests/Tag';
import { BaseComponent } from '@/pageObject/components/BaseComponent';
import { BasePage } from './BasePage';

const log = createLogger('Test');
const browserLog = createLogger('Browser');

/**
 * Resolves the shared test user only when an authenticated request is actually sent.
 * @return JWT of the shared test user
 */
const testUserToken: Token = async () => (await getTestUser()).token;

export type ApiClass<T extends RestClient> = new (request: APIRequestContext, token?: Token) => T;
export type PageClass<T extends BasePage> = new (page: Page) => T;
export type ComponentClass<T extends BaseComponent> = new (page: Page) => T;

export interface Get {
  /**
   * Page object bound to the current page (cached per test). With `route` the navigation is queued as the first step
   * of the chain and skipped when the page is already open:
   * `await get(EditorPage, Route.newArticle).fillData('title', title).clickActionButton('submit')`.
   * @param pageClass - page object class, e.g. `ArticlePage`
   * @param route - hash route to open, e.g. `Route.article(slug)`
   * @return page object; awaiting it, or the chain built on it, runs the queued actions
   */
  <T extends BasePage>(pageClass: PageClass<T>, route?: string): T;
  /**
   * Network mocks and the API/console capture started for the test: `await get(Interceptor).mock(url, response)`.
   * @param interceptorClass - `Interceptor`
   * @return interceptor of the test
   */
  (interceptorClass: typeof Interceptor): Interceptor;
  /**
   * Page component bound to the current page (cached per test): `await get(LocalStorage).getItem('loggedUser')`.
   * Element components (Input, Button, Checkbox, RadioButton, Text) and Confirmation are called from the page instead:
   * `page.button.click(locator)`, `page.confirmation.answerNext('accept')`.
   * @param componentClass - page component class, e.g. `LocalStorage`
   * @return component instance
   */
  <T extends BaseComponent>(componentClass: ComponentClass<T>): T;
  /**
   * REST client authenticated as the shared test user (resolved lazily on the first request), anonymous with
   * `{ guest: true }` or authenticated as another account with `{ token }`; cached per test and per token.
   * Every API call in a test starts here:
   * `get(APIClient).post.articles.with(article)`, `get(APIClient).api.articles.create({ count: 2 })`
   * @param apiClass - REST client class, normally `APIClient`
   * @param options - `{ guest: true }` for a client without a token, `{ token }` for another account's token
   * @return REST client instance
   */
  <T extends RestClient>(apiClass: ApiClass<T>, options?: { guest?: boolean; token?: string }): T;
}

interface BaseFixtures {
  logs: void;
  dataCleaner: void;
  interceptor: Interceptor;
  get: Get;
}

export interface BaseOptions {
  newBrowserPerTest: boolean;
}

interface WorkerFixtures {
  /**
   * Launches the worker's shared browser on first call and returns it (closed when the worker stops).
   * Used instead of the built-in `browser` fixture, which would start an idle browser even for tests that get
   * their own one.
   */
  sharedBrowser: () => Promise<Browser>;
  /**
   * Holds the page of a passed `@keep-page` test until the next test of the same spec file takes it over.
   */
  pageKeeper: PageKeeper;
}

interface PageSession {
  file: string;
  browser: Browser;
  ownsBrowser: boolean;
  context: BrowserContext;
  pages: Page[];
  videoMode: string;
  videoDir?: string;
}

interface PageKeeper {
  session?: PageSession;
}

interface CachedAsset {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

const assetCache = new Map<string, CachedAsset>();

/**
 * Saves the DOM of the page after a failed test to `dom.html` and attaches it as `dom`.
 * Skipped for passed tests, closed pages and pages that never navigated (API tests).
 * @param page - page of the test
 * @param testInfo - info of the finished test (status, output path, attachments)
 */
async function attachDom(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed() || page.url() === 'about:blank') return;
  try {
    const domPath = testInfo.outputPath('dom.html');
    fs.writeFileSync(domPath, await page.content());
    testInfo.attachments.push({ name: 'dom', path: domPath, contentType: 'text/html' });
  } catch (error) {
    log.warn(`DOM snapshot skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Closes the context of a page session, saves its videos to the test that ends the session and closes the browser
 * launched for the session.
 * @param session - session to close
 * @param testInfo - test that ends the session and receives the videos; without it the videos are deleted
 */
async function closeSession(session: PageSession, testInfo?: TestInfo): Promise<void> {
  await session.context.close();
  if (session.videoDir) {
    const target =
      testInfo && (!session.videoMode.startsWith('retain-on') || testInfo.status !== testInfo.expectedStatus)
        ? testInfo
        : undefined;
    const videos = session.pages.map((page) => page.video()).filter((item): item is Video => !!item);
    for (const [index, item] of videos.entries()) {
      if (!target) {
        await item.delete();
        continue;
      }
      const videoPath = target.outputPath(`video${index ? `-${index}` : ''}.webm`);
      await item.saveAs(videoPath);
      target.attachments.push({ name: 'video', path: videoPath, contentType: 'video/webm' });
    }
    fs.rmSync(session.videoDir, { recursive: true, force: true });
  }
  if (session.ownsBrowser) await session.browser.close();
}

/**
 * Base test for every spec: `import { test, expect } from '@/base/BaseTest'`.
 * Test functions receive only `{ get }`; logging and data cleanup run automatically. Nothing is set up globally —
 * each test decides whether it needs a user (authenticated clients, `getTestUser()`, sign-in through the login form).
 */
export const test = base.extend<BaseFixtures & BaseOptions, WorkerFixtures>({
  newBrowserPerTest: [false, { option: true }],

  /**
   * Lazily launched browser shared by the tests of a worker that do not get their own browser.
   * @param playwright - Playwright instance; launches with the configured launch options (headless, slowMo, ...)
   * @param browserName - browser to launch
   * @param use - runs the worker's tests with the launcher
   */
  sharedBrowser: [
    async ({ playwright, browserName }, use) => {
      let browser: Promise<Browser> | undefined;
      await use(() => (browser ??= playwright[browserName].launch()));
      if (browser) await (await browser).close();
    },
    { scope: 'worker' },
  ],

  /**
   * Keeps the page of a passed `@keep-page` test for the next test of the same spec file. On worker shutdown it
   * closes a page nobody took over and deletes the data its test left for the next test.
   * @param playwright - Playwright instance; creates the request context for the leftover cleanup
   * @param use - runs the worker's tests with the keeper
   */
  pageKeeper: [
    async ({ playwright }, use) => {
      const keeper: PageKeeper = {};
      await use(keeper);
      if (keeper.session) await closeSession(keeper.session);
      if (!hasData(ArticlesAPI.CREATED_ARTICLES)) return;
      const request = await playwright.request.newContext({ baseURL: envConfig.baseUrl });
      try {
        await new APIClient(request, testUserToken).api.articles.deleteCreated();
      } finally {
        await request.dispose();
        clearDataStorage();
      }
    },
    { scope: 'worker' },
  ],

  /**
   * Browser context of the test. A test right after a passed `@keep-page` test of the same spec file continues in
   * that test's context and page. Otherwise a new context opens: in a browser launched for the test with
   * `newBrowserPerTest`, else in the worker's shared browser. A passed `@keep-page` test leaves its context open for
   * the next test; any other test closes it, and the video of the whole chain is attached to that test.
   * Playwright applies the context options (baseURL, viewport, locale, timeouts), tracing and failure screenshots
   * to every context it creates; video is recorded here.
   * @param sharedBrowser - launcher of the worker's shared browser (called only without `newBrowserPerTest`)
   * @param playwright - Playwright instance; launches the per-test browser with the configured launch options
   * @param browserName - browser to launch
   * @param video - video mode from the config
   * @param newBrowserPerTest - whether a new chain gets its own browser
   * @param pageKeeper - holder of the page kept by the previous test
   * @param use - runs the test with the context
   * @param testInfo - info of the running test (file, tags, retry, status, output paths)
   */
  context: async ({ sharedBrowser, playwright, browserName, video, newBrowserPerTest, pageKeeper }, use, testInfo) => {
    let session = pageKeeper.session;
    pageKeeper.session = undefined;
    if (session && session.file !== testInfo.file) {
      await closeSession(session);
      session = undefined;
    }
    if (!session) {
      const browser = newBrowserPerTest ? await playwright[browserName].launch() : await sharedBrowser();
      const videoMode = typeof video === 'string' ? video : video.mode;
      const recordVideo =
        videoMode === 'on' ||
        videoMode === 'retain-on-failure' ||
        (videoMode === 'retain-on-first-failure' && testInfo.retry === 0) ||
        ((videoMode === 'on-first-retry' || videoMode === 'retry-with-video') && testInfo.retry === 1);
      const videoDir = recordVideo ? testInfo.outputPath('.video-tmp') : undefined;
      const context = await browser.newContext(videoDir ? { recordVideo: { dir: videoDir } } : {});
      const pages: Page[] = [];
      context.on('page', (page) => pages.push(page));
      session = { file: testInfo.file, browser, ownsBrowser: newBrowserPerTest, context, pages, videoMode, videoDir };
    }

    await use(session.context);

    if (testInfo.tags.includes(Tag.KEEP_PAGE) && testInfo.status === testInfo.expectedStatus) {
      pageKeeper.session = session;
      return;
    }
    await closeSession(session, testInfo);
  },

  /**
   * Logs the test start and end and attaches the collected log lines.
   * @param use - runs the test
   * @param testInfo - info of the running test (title, status, duration)
   */
  logs: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      log.info(`START ${testInfo.titlePath.slice(1).join(' > ')}`);
      await use();
      log.info(`END   ${testInfo.status} in ${testInfo.duration}ms`);
      const lines = drainTestLogs();
      if (lines.length) await testInfo.attach('logs', { body: lines.join('\n'), contentType: 'text/plain' });
    },
    { auto: true },
  ],

  /**
   * Deletes the data registered by API flows after the test and clears TestDataStorage. A passed `@keep-page` test
   * leaves both for the next test, which continues on its page; the test that ends the chain cleans up everything.
   * Declared after `logs`: auto fixtures are torn down in reverse order, so the cleanup is still logged.
   * @param request - API request context used for the cleanup calls
   * @param use - runs the test
   * @param testInfo - info of the finished test (tags, status)
   */
  dataCleaner: [
    async ({ request }, use, testInfo) => {
      await use();
      if (testInfo.tags.includes(Tag.KEEP_PAGE) && testInfo.status === testInfo.expectedStatus) return;
      try {
        await new APIClient(request, testUserToken).api.articles.deleteCreated();
      } finally {
        clearDataStorage();
      }
    },
    { auto: true },
  ],

  /**
   * Page of the test: the page kept by the previous `@keep-page` test, or a new page of a new context. Adds the static
   * asset cache, logging of rate-limited browser requests and a DOM snapshot (`dom.html`) of a failed test; the
   * routes, mocks and listeners of the test are removed after it, so a kept page starts the next test clean.
   * @param context - browser context of the test
   * @param use - runs the test with the page
   * @param testInfo - info of the running test (status, output path, attachments)
   */
  page: async ({ context }, use, testInfo) => {
    const page = context.pages()[0] ?? (await context.newPage());
    const origin = new URL(envConfig.baseUrl).origin;
    await page.context().route(
      (url) => url.origin === origin && !url.pathname.startsWith('/api/'),
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const key = route.request().url();
        try {
          let asset = assetCache.get(key);
          if (!asset) {
            const response = await route.fetch();
            if (response.status() !== 200) {
              await route.fulfill({ response });
              return;
            }
            const { 'content-encoding': _encoding, 'content-length': _length, ...headers } = response.headers();
            asset = { status: 200, headers, body: await response.body() };
            assetCache.set(key, asset);
          }
          await route.fulfill(asset);
        } catch (error) {
          browserLog.debug(`Asset cache skipped for ${key}: ${error instanceof Error ? error.message : String(error)}`);
          await route.continue().catch(() => undefined);
        }
      },
    );
    const logRateLimit = (response: Response): void => {
      if (response.status() === 429) {
        browserLog.warn(
          `${response.request().method()} ${response.url()} -> 429 (retry-after ${response.headers()['retry-after']}s)`,
        );
      }
    };
    page.on('response', logRateLimit);
    await use(page);
    page.off('response', logRateLimit);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.context().unrouteAll({ behavior: 'ignoreErrors' });
    await attachDom(page, testInfo);
  },

  /**
   * Captures the API calls and console output of the test's browser context from the start of the test and attaches
   * the capture to a failed test as `interceptor` (read by `ArtifactsReporter`).
   * @param page - page whose browser context is listened to
   * @param use - runs the test with the listening interceptor
   * @param testInfo - info of the running test (status, attachments)
   */
  interceptor: async ({ page }, use, testInfo) => {
    const interceptor = new Interceptor(page);
    interceptor.attach();
    await use(interceptor);
    interceptor.detach();
    if (testInfo.status === testInfo.expectedStatus) return;
    const capture = { network: await interceptor.network(), console: await interceptor.console() };
    await testInfo.attach('interceptor', { body: JSON.stringify(capture, null, 2), contentType: 'application/json' });
  },

  /**
   * Provides `get(...)`, which creates and caches pages, page components and REST clients for the test.
   * @param request - API request context shared by the REST clients
   * @param page - page shared by the page objects and page components
   * @param interceptor - capture started for the test, returned by `get(Interceptor)`
   * @param use - runs the test with `get`
   */
  get: async ({ request, page, interceptor }, use) => {
    const clients = new Map<string, RestClient>();
    const ui = new Map<Function, BasePage | BaseComponent | Interceptor>([[Interceptor, interceptor]]);

    const get = (
      target: PageClass<BasePage> | ComponentClass<BaseComponent> | ApiClass<RestClient>,
      arg?: string | { guest?: boolean; token?: string },
    ) => {
      if (ui.has(target) || target.prototype instanceof BasePage || target.prototype instanceof BaseComponent) {
        const uiClass = target as new (page: Page) => BasePage | BaseComponent;
        if (!ui.has(uiClass)) ui.set(uiClass, new uiClass(page));
        const instance = ui.get(uiClass)!;
        if (typeof arg === 'string' && instance instanceof BasePage) {
          return instance.navigate(arg);
        }
        return instance;
      }
      const apiClass = target as ApiClass<RestClient>;
      const options = typeof arg === 'object' ? arg : {};
      const key = `${apiClass.name}|${options.guest ? 'guest' : (options.token ?? 'user')}`;
      if (!clients.has(key)) {
        const token = options.guest ? undefined : (options.token ?? testUserToken);
        clients.set(key, new apiClass(request, token));
      }
      return clients.get(key)!;
    };
    await use(get as Get);
  },
});

export const expect = baseExpect.extend(schemaMatchers);
