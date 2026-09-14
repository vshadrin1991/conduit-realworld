import { BaseComponent } from '@/base/BaseComponent';

export class LocalStorage extends BaseComponent {
  async getItem<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.page.evaluate((k) => localStorage.getItem(k), key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async setItem(key: string, value: unknown): Promise<void> {
    this.log.debug(`Set localStorage "${key}"`);
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, serialized]);
  }

  async removeItem(key: string): Promise<void> {
    this.log.debug(`Remove localStorage "${key}"`);
    await this.page.evaluate((k) => localStorage.removeItem(k), key);
  }
}
