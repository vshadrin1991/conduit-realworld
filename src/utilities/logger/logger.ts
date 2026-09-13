import { frameworkConfig } from '@/config/framework.config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const consoleThreshold = LEVELS[frameworkConfig.logLevel];

/**
 * Lines logged in the current worker since the last drain. Tests in a worker run one at a time,
 * so BaseTest drains this after each test and attaches it to the report.
 */
const testLogBuffer: string[] = [];

function format(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export class Logger {
  constructor(private readonly scope: string) {}

  debug(message: string, ...meta: unknown[]): void {
    this.write('debug', message, meta);
  }

  info(message: string, ...meta: unknown[]): void {
    this.write('info', message, meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    this.write('warn', message, meta);
  }

  error(message: string, ...meta: unknown[]): void {
    this.write('error', message, meta);
  }

  private write(level: Level, message: string, meta: unknown[]): void {
    const details = meta.length ? ` ${meta.map(format).join(' ')}` : '';
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${this.scope}] ${message}${details}`;
    // The report attachment keeps every level; the console respects frameworkConfig.logLevel (LOG_LEVEL).
    testLogBuffer.push(line);
    if (LEVELS[level] < consoleThreshold) return;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export const createLogger = (scope: string): Logger => new Logger(scope);

export function drainTestLogs(): string[] {
  return testLogBuffer.splice(0, testLogBuffer.length);
}
