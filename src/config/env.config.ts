import { readOptionalString, readString } from './loader';

const ci = readOptionalString('CI');

/** Target environment: where tests run and how test data is marked. */
export const envConfig = {
  /** Environment name; also selects `.env.<name>` on top of `.env`. */
  name: readString('TEST_ENV', 'demo'),
  /** Application under test; the API lives under `<baseUrl>/api`. */
  baseUrl: readString('BASE_URL', 'https://conduit-realworld-example-app.fly.dev'),
  /** Set by CI systems (any value except false/0). */
  isCI: ci !== undefined && !/^(false|0)$/i.test(ci),
  /** Marker included in generated test data names; only data containing it may be deleted by tests. */
  automationKey: readString('AUTOMATION_KEY', 'pwauto'),
} as const;
