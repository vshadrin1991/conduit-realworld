import { createLogger } from '@/utilities/logger/logger';

const log = createLogger('TestDataStorage');

/**
 * Per-test key/value storage. Java keeps it in a ThreadLocal; a Playwright worker runs one test at a time,
 * so a module-level map is its equivalent. BaseTest clears it after every test.
 */
const data = new Map<string, unknown>();

/** Stores `value` under `key` for the current test. */
export function setData<T>(key: string, value: T): void {
  data.set(key, value);
}

/** @returns the stored value; throws when the key is absent */
export function getData<T>(key: string): T {
  if (!data.has(key)) throw new Error(`The key '${key}' was not found in the data store.`);
  return data.get(key) as T;
}

export function hasData(key: string): boolean {
  return data.has(key);
}

/** Removes everything stored for the current test. */
export function clearDataStorage(): void {
  if (!data.size) return;
  log.info('Clear data storage.');
  data.clear();
}
