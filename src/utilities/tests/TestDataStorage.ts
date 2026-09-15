import { createLogger } from '@/utilities/logger/Logger';

const log = createLogger('TestDataStorage');

/**
 * Per-test key/value storage. Java keeps it in a ThreadLocal; a Playwright worker runs one test at a time,
 * so a module-level map is its equivalent. BaseTest clears it after every test.
 */
const data = new Map<string, unknown>();

/**
 * Stores a value for the current test.
 * @param key - storage key
 * @param value - value to store
 */
export function setData<T>(key: string, value: T): void {
  data.set(key, value);
}

/**
 * Reads a value stored for the current test; throws when the key was not stored.
 * @param key - storage key
 * @return stored value
 */
export function getData<T>(key: string): T {
  if (!data.has(key)) throw new Error(`The key '${key}' was not found in the data store.`);
  return data.get(key) as T;
}

/**
 * Checks whether a value is stored for the current test.
 * @param key - storage key
 * @return `true` when the key is stored
 */
export function hasData(key: string): boolean {
  return data.has(key);
}

/**
 * Removes every stored value; BaseTest calls it after each test.
 */
export function clearDataStorage(): void {
  if (!data.size) return;
  log.info('Clear data storage.');
  data.clear();
}
