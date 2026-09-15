import { test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { createLogger } from '@/utilities/logger/Logger';
import { buildPath, type BasePath } from './path/BasePath';
import { RestClientFactory } from './session/RestClientFactory';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Token = string | (() => Promise<string>);

export interface Request {
  path: BasePath;
  name?: string;
  pathData?: (string | number)[];
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  method?: HttpMethod;
  statusCode?: number | number[];
  headers?: Record<string, string>;
}

/**
 * Core REST client: sends a `Request`, verifies the status code and logs every call. Each call is also a step in the
 * Playwright/Allure report. `Request.headers` overrides the headers of `RestClientFactory` for a single call, e.g. to
 * send another `Authorization` scheme. Constructed by `get(ClientClass)` with the shared test user's token, or
 * without one for `{ guest: true }`.
 */
export class RestClient {
  protected readonly log = createLogger(this.constructor.name);

  constructor(
    protected readonly request: APIRequestContext,
    protected readonly token?: Token,
  ) {}

  async response(req: Request): Promise<APIResponse> {
    const method = req.method ?? 'GET';
    const url = `/api${buildPath(req.path, ...(req.pathData ?? []))}`;
    const title = `API :: ${method} :: ${req.name ?? url}`;

    return inStep(title, async () => {
      const token = typeof this.token === 'function' ? await this.token() : this.token;
      const startedAt = Date.now();
      const response = await this.request.fetch(url, {
        method,
        params: req.params,
        data: req.body,
        headers: { ...RestClientFactory.headers(token), ...req.headers },
      });
      this.log.info(`${title} -> ${response.status()} (${Date.now() - startedAt}ms)${token ? '' : ' [guest]'}`);
      if (response.status() === 429) {
        this.log.warn(`${title} :: rate limited, retry-after ${response.headers()['retry-after']}s`);
      }
      await verifyStatus(response, req, title);
      return response;
    });
  }

  protected async json<T>(req: Request): Promise<T> {
    return (await (await this.response(req)).json()) as T;
  }
}

async function inStep<T>(title: string, body: () => Promise<T>): Promise<T> {
  try {
    test.info();
  } catch {
    return body();
  }
  return test.step(title, body, { box: true });
}

async function verifyStatus(response: APIResponse, req: Request, title: string): Promise<void> {
  const expected = [req.statusCode ?? 200].flat();
  if (expected.includes(0) || expected.includes(response.status())) return;

  const retryAfter = response.headers()['retry-after'];
  const hint = response.status() === 429 ? ` (rate limited, retry after ${retryAfter}s)` : '';
  throw new Error(
    `${title} :: status code => ${response.status()}, expected ${expected.join(' or ')}${hint}\n${await response.text()}`,
  );
}
