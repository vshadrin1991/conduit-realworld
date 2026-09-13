import os from 'node:os';
import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import type { BaseOptions } from './src/base/BaseTest';
import { envConfig } from './src/config/env.config';
import { frameworkConfig } from './src/config/framework.config';
import { reportConfig } from './src/config/report.config';

const DEVICE_BY_BROWSER = {
  chromium: 'Desktop Chrome',
  firefox: 'Desktop Firefox',
  webkit: 'Desktop Safari',
} as const;

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { open: reportConfig.htmlOpen, outputFolder: reportConfig.htmlDir }],
  ['json', { outputFile: reportConfig.jsonFile }],
];
if (reportConfig.allure) {
  reporters.push([
    'allure-playwright',
    {
      resultsDir: reportConfig.allureResultsDir,
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        TEST_ENV: envConfig.name,
        BASE_URL: envConfig.baseUrl,
        BROWSER: frameworkConfig.browser,
        HEADLESS: String(frameworkConfig.headless),
        NODE: process.version,
        OS: `${os.platform()} ${os.release()}`,
      },
      categories: [
        { name: 'Environment: rate limited (429)', messageRegex: '.*(429|rate limited|Too many requests).*' },
        { name: 'Product defects', matchedStatuses: ['failed'] },
        { name: 'Test defects', matchedStatuses: ['broken'] },
      ],
    },
  ]);
}
if (reportConfig.junit) reporters.push(['junit', { outputFile: reportConfig.junitFile }]);

/** All values come from src/config (override with environment variables or .env files). */
export default defineConfig<BaseOptions>({
  testDir: './tests',
  fullyParallel: frameworkConfig.fullyParallel,
  forbidOnly: envConfig.isCI,
  retries: frameworkConfig.retries,
  workers: frameworkConfig.workers,
  timeout: frameworkConfig.timeouts.test,
  reporter: reporters,

  use: {
    baseURL: envConfig.baseUrl,
    headless: frameworkConfig.headless,
    locale: frameworkConfig.locale,
    timezoneId: frameworkConfig.timezoneId,
    launchOptions: { slowMo: frameworkConfig.slowMo },
    trace: frameworkConfig.trace,
    screenshot: frameworkConfig.screenshot,
    video: frameworkConfig.video,
    actionTimeout: frameworkConfig.timeouts.action,
    navigationTimeout: frameworkConfig.timeouts.navigation,
  },
  expect: { timeout: frameworkConfig.timeouts.expect },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      // Spec files run in parallel workers; the tests of one file run one by one in their worker.
      fullyParallel: frameworkConfig.uiFullyParallel,
      use: {
        ...devices[DEVICE_BY_BROWSER[frameworkConfig.browser]],
        viewport: frameworkConfig.viewport,
        // Every test launches its own new browser (BaseTest `context` fixture).
        newBrowserPerTest: frameworkConfig.uiNewBrowserPerTest,
      },
    },
  ],
});
