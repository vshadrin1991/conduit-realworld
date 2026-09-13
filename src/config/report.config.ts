import path from 'node:path';
import { envConfig } from './env.config';
import { readBoolean, readEnum, readString, ROOT_DIR } from './loader';

const dir = path.resolve(ROOT_DIR, readString('REPORTS_DIR', 'reports'));

/**
 * Reporters. The npm scripts (`report`, `allure:*`, `results`) expect the default `reports` directory.
 */
export const reportConfig = {
  dir,
  htmlDir: path.join(dir, 'html'),
  /** `always` / `on-failure` open the HTML report after a local run. */
  htmlOpen: readEnum('HTML_REPORT_OPEN', ['never', 'always', 'on-failure'] as const, 'never'),
  /** Machine-readable results, consumed by the playwright-ts-test-results skill. */
  jsonFile: path.join(dir, 'results.json'),
  allure: readBoolean('ALLURE', true),
  allureResultsDir: path.join(dir, 'allure-results'),
  junit: readBoolean('JUNIT', envConfig.isCI),
  junitFile: path.join(dir, 'junit.xml'),
} as const;
