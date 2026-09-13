import { envConfig } from './env.config';
import { readBoolean, readEnum, readNumber, readOptionalNumber, readString } from './loader';

export const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
const TRACE_MODES = [
  'off',
  'on',
  'retain-on-failure',
  'on-first-retry',
  'on-all-retries',
  'retain-on-first-failure',
] as const;
const VIDEO_MODES = ['off', 'on', 'retain-on-failure', 'on-first-retry'] as const;
const SCREENSHOT_MODES = ['off', 'on', 'only-on-failure', 'on-first-failure'] as const;
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type Browser = (typeof BROWSERS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Test runner and browser settings consumed by playwright.config.ts and the framework. */
export const frameworkConfig = {
  /** Browser of the `ui` project. Install others with `npx playwright install <browser>`. */
  browser: readEnum('BROWSER', BROWSERS, 'chromium'),
  headless: readBoolean('HEADLESS', false),
  /** Delay in ms added to every browser operation (debugging). */
  slowMo: readNumber('SLOW_MO', 0),
  viewport: {
    width: readNumber('VIEWPORT_WIDTH', 1280),
    height: readNumber('VIEWPORT_HEIGHT', 720),
  },
  locale: readString('LOCALE', 'en-US'),
  timezoneId: readString('TIMEZONE', 'UTC'),

  /** Parallel workers; undefined uses the Playwright default (half of the CPU cores). */
  workers: readOptionalNumber('WORKERS') ?? (envConfig.isCI ? 2 : undefined),
  /** Keep retries low: the environment is rate limited, so retries mostly burn request budget. */
  retries: readNumber('RETRIES', envConfig.isCI ? 1 : 0),
  /** Parallel mode of the `api` project: every test may run in its own worker. */
  fullyParallel: readBoolean('FULLY_PARALLEL', true),
  /**
   * Parallel mode of the `ui` project. `false` (default): one worker per spec file; the file's tests run one after
   * another in it while files run in parallel.
   */
  uiFullyParallel: readBoolean('UI_FULLY_PARALLEL', false),
  /**
   * `ui` project: `true` (default) launches a new browser for every test and closes it after the test;
   * `false` opens each test in a new context of the worker's shared browser (faster).
   */
  uiNewBrowserPerTest: readBoolean('UI_NEW_BROWSER_PER_TEST', true),

  timeouts: {
    test: readNumber('TEST_TIMEOUT', 30_000),
    expect: readNumber('EXPECT_TIMEOUT', 10_000),
    action: readNumber('ACTION_TIMEOUT', 10_000),
    navigation: readNumber('NAVIGATION_TIMEOUT', 30_000),
  },

  trace: readEnum('TRACE', TRACE_MODES, 'retain-on-failure'),
  video: readEnum('VIDEO', VIDEO_MODES, 'retain-on-failure'),
  screenshot: readEnum('SCREENSHOT', SCREENSHOT_MODES, 'only-on-failure'),

  /** Console log level; report `logs` attachments always contain every level. */
  logLevel: readEnum('LOG_LEVEL', LOG_LEVELS, 'info'),
} as const;
