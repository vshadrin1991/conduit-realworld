import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const ROOT_DIR = path.resolve(__dirname, '../..');

function readEnvFile(fileName: string): NodeJS.Dict<string> {
  const file = path.join(ROOT_DIR, fileName);
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf-8')) : {};
}

/**
 * Loads config variables once per process.
 * Precedence: real environment variables → `.env.<TEST_ENV>` → `.env` → defaults in the `*.config.ts` files.
 */
function loadEnvFiles(): void {
  const base = readEnvFile('.env');
  const testEnv = process.env.TEST_ENV ?? base.TEST_ENV;
  const specific = testEnv ? readEnvFile(`.env.${testEnv}`) : {};
  for (const [key, value] of Object.entries({ ...base, ...specific })) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
}

loadEnvFiles();

function raw(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function readOptionalString(name: string): string | undefined {
  return raw(name);
}

export function readString(name: string, fallback: string): string {
  return raw(name) ?? fallback;
}

export function readBoolean(name: string, fallback: boolean): boolean {
  const value = raw(name);
  if (value === undefined) return fallback;
  if (/^(true|1|yes|on)$/i.test(value)) return true;
  if (/^(false|0|no|off)$/i.test(value)) return false;
  throw new Error(`Config ${name}="${value}" is not a boolean (use true or false).`);
}

export function readOptionalNumber(name: string): number | undefined {
  const value = raw(name);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Config ${name}="${value}" is not a number.`);
  return number;
}

export function readNumber(name: string, fallback: number): number {
  return readOptionalNumber(name) ?? fallback;
}

export function readEnum<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = raw(name);
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) {
    throw new Error(`Config ${name}="${value}" is not one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}
