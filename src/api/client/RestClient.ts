import { test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { createLogger } from '@/utilities/logger/logger';
import { buildPath, type ConduitBasePath } from './path/ConduitBasePath';
import { RestClientFactory } from './session/RestClientFactory';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A JWT, or a provider resolved on the first authenticated request (e.g. `async () => (await getTestUser()).token`). */
export type Token = string | (() => Promise<string>);
export type Operator = 'SIZE_MORE' | 'SIZE_LESS' | 'EQUALS' | 'STATUS_CODE' | 'NONE';

/** Response condition to wait for (the request is repeated while it is not met). */
export interface Condition {
  /** Dot path in the JSON body, e.g. `articles` or `article.slug`; empty for the whole body. */
  path?: string;
  operator: Operator;
  value?: unknown;
  /** Extra attempts, 1s apart. Every attempt spends rate-limit budget, so keep it small. */
  retries?: number;
}

export interface Request {
  path: ConduitBasePath;
  /** Readable name for logs and report steps; defaults to the resolved URL. */
  name?: string;
  /** Values for the `{dataN}` placeholders of `path`. */
  pathData?: (string | number)[];
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  method?: HttpMethod;
  /** Expected status code(s); default 200. `0` disables the check. Ignored with a `STATUS_CODE` condition. */
  statusCode?: number | number[];
  condition?: Condition;
}

/**
 * Core REST client: sends a `Request`, retries it while its `condition` is not met, verifies the status code
 * and logs every call. Each call is also a step in the Playwright/Allure report.
 * Constructed by `get(ClientClass)` with the shared test user's token, or without one for `{ guest: true }`.
 */
export class RestClient {
  protected readonly log = createLogger(this.constructor.name);

  constructor(
    protected readonly request: APIRequestContext,
    protected readonly token?: Token,
  ) {}

  /** Sends the request and returns the raw response once the status code check has passed. */
  async response(req: Request): Promise<APIResponse> {
    const method = req.method ?? 'GET';
    const url = `/api${buildPath(req.path, ...(req.pathData ?? []))}`;
    const title = `API :: ${method} :: ${req.name ?? url}`;

    return inStep(title, async () => {
      const retries = req.condition?.retries ?? 0;
      const token = typeof this.token === 'function' ? await this.token() : this.token;
      let response!: APIResponse;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const startedAt = Date.now();
        response = await this.request.fetch(url, {
          method,
          params: req.params,
          data: req.body,
          headers: RestClientFactory.headers(token),
        });
        this.log.info(`${title} -> ${response.status()} (${Date.now() - startedAt}ms)${token ? '' : ' [guest]'}`);

        if (response.status() === 429) {
          this.log.warn(`${title} :: rate limited, retry-after ${response.headers()['retry-after']}s`);
          break;
        }
        if (!req.condition || (await conditionMet(response, req.condition))) break;
        if (attempt < retries) {
          this.log.debug(`${title} :: condition not met, retries left: ${retries - attempt}`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      await verifyStatus(response, req, title);
      return response;
    });
  }

  /** Sends the request and returns the parsed JSON body. */
  protected async json<T>(req: Request): Promise<T> {
    return (await (await this.response(req)).json()) as T;
  }
}

async function inStep<T>(title: string, body: () => Promise<T>): Promise<T> {
  try {
    test.info();
  } catch {
    return body(); // outside of a running test (e.g. worker fixtures)
  }
  return test.step(title, body, { box: true });
}

function readPath(body: unknown, path?: string): unknown {
  if (!path) return body;
  return path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], body);
}

async function conditionMet(response: APIResponse, { path, operator, value }: Condition): Promise<boolean> {
  if (operator === 'NONE') return true;
  if (operator === 'STATUS_CODE') return response.status() === value;
  if (!response.ok()) return false;
  const actual = readPath(await response.json(), path);
  switch (operator) {
    case 'SIZE_MORE':
      return Array.isArray(actual) && actual.length > Number(value);
    case 'SIZE_LESS':
      return Array.isArray(actual) && actual.length < Number(value);
    case 'EQUALS':
      return actual === value;
  }
}

async function verifyStatus(response: APIResponse, req: Request, title: string): Promise<void> {
  const expected =
    req.condition?.operator === 'STATUS_CODE' ? [Number(req.condition.value)] : [req.statusCode ?? 200].flat();
  if (expected.includes(0) || expected.includes(response.status())) return;

  const retryAfter = response.headers()['retry-after'];
  const hint = response.status() === 429 ? ` (rate limited, retry after ${retryAfter}s)` : '';
  throw new Error(
    `${title} :: status code => ${response.status()}, expected ${expected.join(' or ')}${hint}\n${await response.text()}`,
  );
}
