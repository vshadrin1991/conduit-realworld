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
  htmlOpen: readEnum('HTML_REPORT_OPEN', ['never', 'always', 'on-failure'] as const, 'never'),
  jsonFile: path.join(dir, 'results.json'),
  outputDir: path.join(dir, 'test-results'),
  allure: readBoolean('ALLURE', true),
  allureResultsDir: path.join(dir, 'allure-results'),
  junit: readBoolean('JUNIT', envConfig.isCI),
  junitFile: path.join(dir, 'junit.xml'),
  artifacts: readBoolean('ARTIFACTS', true),
  artifactsFile: path.join(dir, 'artifacts.json'),
} as const;
