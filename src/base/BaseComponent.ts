import type { Page } from '@playwright/test';
import { createLogger } from '@/utilities/logger/Logger';

/**
 * Base for page components only: element helpers (Input, Button, Checkbox, ...) that act on a locator passed to each
 * call, page fragments (Header), native dialogs (Confirmation) and the page's LocalStorage. Classes that are not about
 * the page do not extend it — `Interceptor`, for example, belongs to utilities.
 */
export abstract class BaseComponent {
  protected readonly log = createLogger(this.constructor.name);

  constructor(readonly page: Page) {}
}
