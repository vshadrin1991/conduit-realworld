import type { ConsoleMessage, Page, Request, WebError } from '@playwright/test';
import { frameworkConfig } from '@/config/framework.config';
import { createLogger } from '@/utilities/logger/Logger';
import type { ConsoleEntry, ConsoleLevel } from './entry/ConsoleEntry';
import type { NetworkEntry } from './entry/NetworkEntry';

const TEXT_CONTENT_TYPES = ['application/json', 'text/plain', 'application/xml'];
const SECRET_VALUE = /("[^"]*(?:password|token|secret)[^"]*"\s*:\s*)"(?:[^"\\]|\\.)*"/gi;
const CONSOLE_TEXT_MIN = 512;

export interface MockResponse {
  status?: number;
  json?: unknown;
  body?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

/**
 * Masks secret JSON values (passwords, tokens) and cuts the text to the given length.
 * @param text - request or response body, or console text
 * @param max - maximum number of characters to keep; `0` keeps nothing
 * @return masked and truncated text, or `null` for empty input
 */
function redact(text: string | null | undefined, max: number): string | null {
  if (!text || max <= 0) return null;
  const masked = text.replace(SECRET_VALUE, '$1"***"');
  return masked.length > max ? `${masked.slice(0, max)}...` : masked;
}

export class Interceptor {
  private readonly log = createLogger('Interceptor');
  private readonly networkEntries: NetworkEntry[] = [];
  private readonly consoleEntries: ConsoleEntry[] = [];
  private readonly pending = new Set<Promise<void>>();
  private attached = false;

  /**
   * @param page - page whose browser context is mocked and listened to
   */
  constructor(private readonly page: Page) {}

  /**
   * Replies to matching browser requests with the given response instead of sending them to the server.
   * @param url - URL glob or regular expression of the requests to mock
   * @param response - status, JSON or text body, content type and headers to reply with
   */
  async mock(url: string | RegExp, response: MockResponse): Promise<void> {
    this.log.info(`Mock ${url} -> ${response.status ?? 200}`);
    await this.page.route(url, (route) => route.fulfill(response));
  }

  /**
   * Starts capturing the API calls and console output of the browser context; BaseTest calls it when the test starts.
   * What is kept depends on `INTERCEPTOR_NETWORK` and `INTERCEPTOR_CONSOLE`; repeated calls do nothing.
   */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    const context = this.page.context();
    if (frameworkConfig.interceptor.network !== 'off') {
      context.on('requestfinished', this.onRequestFinished);
      context.on('requestfailed', this.onRequestFailed);
    }
    if (frameworkConfig.interceptor.console !== 'off') {
      context.on('console', this.onConsole);
      context.on('weberror', this.onWebError);
    }
  }

  /**
   * Stops capturing, so a page kept for the next test does not collect this test's entries twice.
   * Already captured entries stay readable.
   */
  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    const context = this.page.context();
    context.off('requestfinished', this.onRequestFinished);
    context.off('requestfailed', this.onRequestFailed);
    context.off('console', this.onConsole);
    context.off('weberror', this.onWebError);
  }

  /**
   * Returns the captured browser calls under `/api/`, oldest first, once pending captures have finished.
   * @return captured API calls (only failed ones in the default `failed` mode)
   */
  async network(): Promise<NetworkEntry[]> {
    await Promise.allSettled([...this.pending]);
    return [...this.networkEntries].sort((a, b) => a.at - b.at);
  }

  /**
   * Returns the captured console messages and uncaught page errors, oldest first.
   * @return captured console entries (errors and warnings in the default `errors` mode)
   */
  async console(): Promise<ConsoleEntry[]> {
    await Promise.allSettled([...this.pending]);
    return [...this.consoleEntries];
  }

  /**
   * Captures a finished browser request.
   * @param request - request that got a response
   */
  private readonly onRequestFinished = (request: Request): void => this.track(this.captureRequest(request, false));

  /**
   * Captures a browser request that failed before a response arrived.
   * @param request - failed request
   */
  private readonly onRequestFailed = (request: Request): void => this.track(this.captureRequest(request, true));

  /**
   * Captures a console message of any page of the context.
   * @param message - console message reported by the browser
   */
  private readonly onConsole = (message: ConsoleMessage): void => this.captureConsole(message);

  /**
   * Captures an uncaught page error as a console error.
   * @param webError - error thrown in a page of the context
   */
  private readonly onWebError = (webError: WebError): void =>
    this.addConsole('error', webError.error().message, null);

  /**
   * Remembers an asynchronous capture so the readers can wait for it.
   * @param capture - capture of one request
   */
  private track(capture: Promise<void>): void {
    this.pending.add(capture);
    void capture.finally(() => this.pending.delete(capture));
  }

  /**
   * Stores a finished or failed browser request under `/api/` when the network mode keeps it.
   * @param request - finished or failed browser request
   * @param failed - `true` when the browser reported the request as failed before a response arrived
   */
  private async captureRequest(request: Request, failed: boolean): Promise<void> {
    try {
      if (!new URL(request.url()).pathname.startsWith('/api/')) return;
      const at = Date.now();
      const response = failed ? null : await request.response();
      const status = response?.status() ?? null;
      const failure = failed ? (request.failure()?.errorText ?? 'request failed') : null;
      if (frameworkConfig.interceptor.network === 'failed' && failure === null && (status ?? 0) < 400) return;
      const { bodyMax } = frameworkConfig.interceptor;
      const contentType = response?.headers()['content-type'] ?? '';
      const textual = TEXT_CONTENT_TYPES.some((type) => contentType.includes(type));
      const responseEnd = request.timing().responseEnd;
      this.networkEntries.push({
        method: request.method(),
        url: request.url(),
        status,
        statusText: response?.statusText() ?? null,
        durationMs: responseEnd < 0 ? null : Math.round(responseEnd),
        requestBody: redact(request.postData(), bodyMax),
        responseBody: response && textual ? redact(await response.text(), bodyMax) : null,
        failure,
        at,
      });
    } catch (error) {
      this.log.warn(`Could not capture ${request.url()}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Converts a console message of any page of the context into a console entry.
   * @param message - console message reported by the browser
   */
  private captureConsole(message: ConsoleMessage): void {
    const type = message.type();
    const level: ConsoleLevel =
      type === 'error' ? 'error' : type === 'warning' ? 'warning' : type === 'debug' ? 'debug' : 'info';
    const { url, lineNumber, columnNumber } = message.location();
    this.addConsole(level, message.text(), url ? `${url}:${lineNumber}:${columnNumber}` : null);
  }

  /**
   * Stores a console entry when the console mode keeps its level.
   * @param level - level of the message
   * @param text - message text, masked and truncated before it is stored
   * @param location - source location of the message, `null` when unknown
   */
  private addConsole(level: ConsoleLevel, text: string, location: string | null): void {
    if (frameworkConfig.interceptor.console === 'errors' && level !== 'error' && level !== 'warning') return;
    const max = Math.max(frameworkConfig.interceptor.bodyMax, CONSOLE_TEXT_MIN);
    this.consoleEntries.push({ level, text: redact(text, max) ?? '', location, at: Date.now() });
  }
}
