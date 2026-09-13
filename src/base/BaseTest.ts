import fs from 'node:fs';
import { test as base, expect, type APIRequestContext, type Browser, type Page, type Video } from '@playwright/test';
import { ConduitRestClient } from '@/api/client/ConduitRestClient';
import type { RestClient, Token } from '@/api/client/RestClient';
import { getTestUser } from '@/api/client/session/auth/testUser';
import { envConfig } from '@/config/env.config';
import { createLogger, drainTestLogs } from '@/utilities/logger/logger';
import { clearDataStorage } from '@/utilities/tests/TestDataStorage';
import { BaseComponent } from './BaseComponent';
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
   * Page object bound to the current page (cached per test). With `route`, navigation (skipped if already there)
   * and waiting for the page are queued. Page calls chain and run when awaited:
   * `await get(EditorPage, Route.newArticle).fillData('title', title).clickActionButton('submit')`
   * @param pageClass - page object class, e.g. `ArticlePage`
   * @param route - optional hash route to open, e.g. `Route.article(slug)`
   * @return page object instance
   */
  <T extends BasePage>(pageClass: PageClass<T>, route?: string): T;
  /**
   * Component bound to the current page (cached per test): `get(Session).login()`, `get(Confirmation).answerNext(...)`.
   * Element components (Input, Button, Checkbox, RadioButton, Text) are called from the page instead: `page.button.click(locator)`.
   * @param componentClass - component class, e.g. `Session`
   * @return component instance
   */
  <T extends BaseComponent>(componentClass: ComponentClass<T>): T;
  /**
   * REST client authenticated as the shared test user (resolved lazily on the first request),
   * or anonymous with `{ guest: true }`; cached per test. Every API call in a test starts here:
   * `get(ConduitRestClient).post.articles.with(article)`, `get(ConduitRestClient).api.articles.create({ count: 2 })`
   * @param apiClass - REST client class, normally `ConduitRestClient`
   * @param options - `{ guest: true }` for a client without a token
   * @return REST client instance
   */
  <T extends RestClient>(apiClass: ApiClass<T>, options?: { guest?: boolean }): T;
}

interface BaseFixtures {
  /** Auto: logs test start/end and attaches the test's log lines to the report as `logs`. */
  logs: void;
  /** Auto: after each test deletes the data registered by API flows and clears TestDataStorage. */
  dataCleaner: void;
  /** The only fixture tests use: `test('...', async ({ get }) => { ... })`. */
  get: Get;
}

/** Options set per project in playwright.config.ts (`use: { ... }`). */
export interface BaseOptions {
  /** Launch a new browser for every test (closed after the test) instead of sharing the worker's browser. */
  newBrowserPerTest: boolean;
}

interface WorkerFixtures {
  /**
   * Launches the worker's shared browser on first call and returns it (closed when the worker stops).
   * Used instead of the built-in `browser` fixture, which would start an idle browser even for tests that get
   * their own one.
   */
  sharedBrowser: () => Promise<Browser>;
}

interface CachedAsset {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/** Static files of the SPA, cached per worker to save rate-limit budget. */
const assetCache = new Map<string, CachedAsset>();

/**
 * Base test for every spec: `import { test, expect } from '@/base/BaseTest'`.
 * Test functions receive only `{ get }`; logging and data cleanup run automatically. Nothing is set up globally —
 * each test decides whether it needs a user (authenticated clients, `getTestUser()`, `get(Session).login()`).
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
   * Browser context of the test. With `newBrowserPerTest` a new browser is launched for the test and closed after it;
   * otherwise the context opens in the worker's shared browser. Only one browser is ever started for a test.
   * Playwright applies the context options (baseURL, viewport, locale, timeouts), tracing and failure screenshots
   * to every context it creates; video is recorded here.
   * @param sharedBrowser - launcher of the worker's shared browser (called only without `newBrowserPerTest`)
   * @param playwright - Playwright instance; launches the per-test browser with the configured launch options
   * @param browserName - browser to launch
   * @param video - video mode from the config
   * @param newBrowserPerTest - whether the test gets its own browser
   * @param use - runs the test with the context
   * @param testInfo - info of the running test (retry, status, output paths)
   */
  context: async ({ sharedBrowser, playwright, browserName, video, newBrowserPerTest }, use, testInfo) => {
    const owner = newBrowserPerTest ? await playwright[browserName].launch() : await sharedBrowser();
    const videoMode = typeof video === 'string' ? video : video.mode;
    const recordVideo =
      videoMode === 'on' ||
      videoMode === 'retain-on-failure' ||
      (videoMode === 'retain-on-first-failure' && testInfo.retry === 0) ||
      ((videoMode === 'on-first-retry' || videoMode === 'retry-with-video') && testInfo.retry === 1);
    const videoDir = testInfo.outputPath('.video-tmp');
    const context = await owner.newContext(recordVideo ? { recordVideo: { dir: videoDir } } : {});
    const pages: Page[] = [];
    context.on('page', (page) => pages.push(page));

    await use(context);

    await context.close();
    if (recordVideo) {
      // retain-on-* modes keep the video only for a failed test.
      const keep = !videoMode.startsWith('retain-on') || testInfo.status !== testInfo.expectedStatus;
      const videos = pages.map((page) => page.video()).filter((item): item is Video => !!item);
      for (const [index, item] of videos.entries()) {
        if (!keep) {
          await item.delete();
          continue;
        }
        const videoPath = testInfo.outputPath(`video${index ? `-${index}` : ''}.webm`);
        await item.saveAs(videoPath);
        testInfo.attachments.push({ name: 'video', path: videoPath, contentType: 'video/webm' });
      }
      fs.rmSync(videoDir, { recursive: true, force: true });
    }
    if (newBrowserPerTest) await owner.close();
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
   * Deletes the data registered by API flows after the test and clears TestDataStorage.
   * Declared after `logs`: auto fixtures are torn down in reverse order, so the cleanup is still logged.
   * @param request - API request context used for the cleanup calls
   * @param use - runs the test
   */
  dataCleaner: [
    async ({ request }, use) => {
      await use();
      try {
        await new ConduitRestClient(request, testUserToken).api.articles.deleteCreated();
      } finally {
        clearDataStorage();
      }
    },
    { auto: true },
  ],

  /**
   * Extends the built-in page: static asset cache + logging of rate-limited browser requests.
   * @param page - built-in Playwright page
   * @param use - runs the test with the extended page
   */
  page: async ({ page }, use) => {
    const origin = new URL(envConfig.baseUrl).origin;
    await page.context().route(
      (url) => url.origin === origin && !url.pathname.startsWith('/api/'),
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        const key = route.request().url();
        let asset = assetCache.get(key);
        if (!asset) {
          const response = await route.fetch();
          if (response.status() !== 200) return route.fulfill({ response });
          const { 'content-encoding': _encoding, 'content-length': _length, ...headers } = response.headers();
          asset = { status: 200, headers, body: await response.body() };
          assetCache.set(key, asset);
        }
        await route.fulfill(asset);
      },
    );
    page.on('response', (response) => {
      if (response.status() === 429) {
        browserLog.warn(
          `${response.request().method()} ${response.url()} -> 429 (retry-after ${response.headers()['retry-after']}s)`,
        );
      }
    });
    await use(page);
  },

  /**
   * Provides `get(...)`, which creates and caches pages, components and REST clients for the test.
   * @param request - API request context shared by the REST clients
   * @param page - page shared by the page objects and components
   * @param use - runs the test with `get`
   */
  get: async ({ request, page }, use) => {
    const clients = { user: new Map<Function, RestClient>(), guest: new Map<Function, RestClient>() };
    const ui = new Map<Function, BasePage | BaseComponent>();

    const get = (
      target: PageClass<BasePage> | ComponentClass<BaseComponent> | ApiClass<RestClient>,
      arg?: string | { guest?: boolean },
    ) => {
      if (target.prototype instanceof BasePage || target.prototype instanceof BaseComponent) {
        const uiClass = target as new (page: Page) => BasePage | BaseComponent;
        if (!ui.has(uiClass)) ui.set(uiClass, new uiClass(page));
        const instance = ui.get(uiClass)!;
        return typeof arg === 'string' && instance instanceof BasePage ? instance.navigate(arg) : instance;
      }
      const apiClass = target as ApiClass<RestClient>;
      const guest = typeof arg === 'object' && !!arg.guest;
      const cache = guest ? clients.guest : clients.user;
      if (!cache.has(apiClass)) cache.set(apiClass, new apiClass(request, guest ? undefined : testUserToken));
      return cache.get(apiClass)!;
    };
    await use(get as Get);
  },
});

/** Tag for tests that call the auth endpoints, which allow only ~5 requests/hour per IP. */
export const AUTH_QUOTA = '@auth-quota';

export { expect };
