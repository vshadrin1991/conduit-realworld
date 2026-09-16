import { BaseComponent } from './BaseComponent';

export class LocalStorage extends BaseComponent {
  /**
   * Reads a localStorage item of the current page, parsed as JSON when possible.
   * @param key - item key, e.g. `loggedUser`
   * @return parsed value, the raw string when it is not JSON, or `null` when the item is absent
   */
  async getItem<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.page.evaluate((k) => localStorage.getItem(k), key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
}
