import fs from 'node:fs';
import {
  test as base,
  expect as baseExpect,
  type APIRequestContext,
  type Browser,
  type Page,
  type TestInfo,
  type Video,
} from '@playwright/test';
import { APIClient } from '@/api/client/APIClient';
import type { RestClient, Token } from '@/api/client/RestClient';
import { schemaMatchers } from '@/api/schemas/SchemaMatcher';
import { getTestUser } from '@/api/client/session/auth/User';
import { envConfig } from '@/config/env.config';
import { createLogger, drainTestLogs } from '@/utilities/logger/Logger';
import { Interceptor } from '@/utilities/interceptor/Interceptor';
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
        await new APIClient(request, testUserToken).api.articles.deleteCreated();
      } finally {
        clearDataStorage();
      }
    },
    { auto: true },
  ],

  /**
   * Extends the built-in page: static asset cache + logging of rate-limited browser requests + DOM snapshot
   * (`dom.html`) of a failed test.
   * @param page - built-in Playwright page
   * @param use - runs the test with the extended page
   * @param testInfo - info of the running test (status, output path, attachments)
   */
  page: async ({ page }, use, testInfo) => {
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
    page.on('response', (response) => {
      if (response.status() === 429) {
        browserLog.warn(
          `${response.request().method()} ${response.url()} -> 429 (retry-after ${response.headers()['retry-after']}s)`,
        );
      }
    });
    await use(page);
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
        return typeof arg === 'string' && instance instanceof BasePage ? instance.navigate(arg) : instance;
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

export const AUTH_QUOTA = '@auth-quota';

export const expect = baseExpect.extend(schemaMatchers);
