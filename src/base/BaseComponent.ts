import type { Page } from '@playwright/test';
import { createLogger } from '@/utilities/logger/logger';

/**
 * Base for reusable UI components: element helpers (Input, Button, Checkbox, ...) that act on a locator
 * passed to each call, and page fragments (Header). Obtain them in tests through `get(ComponentClass)`.
 */
export abstract class BaseComponent {
  protected readonly log = createLogger(this.constructor.name);

  constructor(readonly page: Page) {}
}
