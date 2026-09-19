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

  /**
   * Writes a localStorage item of the current page; objects are stored as JSON.
   * @param key - item key, e.g. `loggedUser`
   * @param value - value to store
   * @return promise resolved when the item is written
   */
  async setItem(key: string, value: unknown): Promise<void> {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, raw]);
  }
}
