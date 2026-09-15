import { frameworkConfig } from '@/config/framework.config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const consoleThreshold = LEVELS[frameworkConfig.logLevel];

/**
 * Lines logged in the current worker since the last drain. Tests in a worker run one at a time,
 * so BaseTest drains this after each test and attaches it to the report.
 */
const testLogBuffer: string[] = [];

/**
 * Turns an extra log argument into text: the stack of an error, JSON of an object, otherwise the string value.
 * @param value - extra argument passed to a log call
 * @return text appended to the log line
 */
function format(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export class Logger {
  /**
   * Creates a logger whose lines are tagged with the scope.
   * @param scope - name shown in brackets in every line, e.g. `LoginPage`
   */
  constructor(private readonly scope: string) {}

  /**
   * Logs a line with the `debug` level.
   * @param message - text of the line
   * @param meta - extra values appended to the line
   */
  debug(message: string, ...meta: unknown[]): void {
    this.write('debug', message, meta);
  }

  /**
   * Logs a line with the `info` level.
   * @param message - text of the line
   * @param meta - extra values appended to the line
   */
  info(message: string, ...meta: unknown[]): void {
    this.write('info', message, meta);
  }

  /**
   * Logs a line with the `warn` level.
   * @param message - text of the line
   * @param meta - extra values appended to the line
   */
  warn(message: string, ...meta: unknown[]): void {
    this.write('warn', message, meta);
  }

  /**
   * Logs a line with the `error` level.
   * @param message - text of the line
   * @param meta - extra values appended to the line
   */
  error(message: string, ...meta: unknown[]): void {
    this.write('error', message, meta);
  }

  /**
   * Formats the line, stores it for the test report and prints it when the level reaches the console threshold.
   * @param level - level of the line
   * @param message - text of the line
   * @param meta - extra values appended to the line
   */
  private write(level: Level, message: string, meta: unknown[]): void {
    const details = meta.length ? ` ${meta.map(format).join(' ')}` : '';
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${this.scope}] ${message}${details}`;
    testLogBuffer.push(line);
    if (LEVELS[level] < consoleThreshold) return;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

/**
 * Creates a logger for a class or module.
 * @param scope - name shown in brackets in every line, e.g. `LoginPage`
 * @return logger instance
 */
export const createLogger = (scope: string): Logger => new Logger(scope);

/**
 * Takes every line logged since the last drain and empties the buffer.
 * @return logged lines in order
 */
export function drainTestLogs(): string[] {
  return testLogBuffer.splice(0, testLogBuffer.length);
}
