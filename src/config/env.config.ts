import { readOptionalString, readString } from './loader';

const ci = readOptionalString('CI');

export const envConfig = {
  name: readString('TEST_ENV', 'demo'),
  baseUrl: readString('BASE_URL', 'https://conduit-realworld-example-app.fly.dev'),
  isCI: ci !== undefined && !/^(false|0)$/i.test(ci),
  automationKey: readString('AUTOMATION_KEY', 'pwauto'),
} as const;
