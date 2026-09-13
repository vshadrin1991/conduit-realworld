import { BaseComponent } from '@/base/BaseComponent';

export interface MockResponse {
  status?: number;
  json?: unknown;
  body?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

/** Network interception for the current page — renders states the backend cannot produce on demand. */
export class Interceptor extends BaseComponent {
  /** Answers matching requests with `response`; they never reach the server. Register before the action. */
  async mock(url: string | RegExp, response: MockResponse): Promise<void> {
    this.log.info(`Mock ${url} -> ${response.status ?? 200}`);
    await this.page.route(url, (route) => route.fulfill(response));
  }

  async unmock(url: string | RegExp): Promise<void> {
    this.log.info(`Unmock ${url}`);
    await this.page.unroute(url);
  }
}
