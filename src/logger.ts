import { format } from 'node:util';
import type { LogLevel, Logger } from './types.ts';

const LEVELS: readonly LogLevel[] = ['info', 'verbose', 'debug'];

const COLORS: Readonly<Record<string, string>> = {
  info: '\u001B[32m',
  verbose: '\u001B[36m',
  debug: '\u001B[34m',
  error: '\u001B[31m'
};

const pad = (n: number, length = 2): string => String(n).padStart(length, '0');

function timestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** Default logger: writes `printf`-style formatted messages to the console, filtered by level. */
export class ConsoleLogger implements Logger {
  readonly level: LogLevel;
  readonly silent: boolean;

  constructor(level: LogLevel | false = 'info') {
    this.silent = level === false;
    this.level = level === false ? 'info' : level;
  }

  info(message: string, ...args: unknown[]): void {
    this.#write('info', message, args);
  }

  verbose(message: string, ...args: unknown[]): void {
    this.#write('verbose', message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.#write('debug', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.#write('error', message, args);
  }

  #write(level: LogLevel | 'error', message: string, args: unknown[]): void {
    if (this.silent) {
      return;
    }

    if (level !== 'error' && LEVELS.indexOf(level) > LEVELS.indexOf(this.level)) {
      return;
    }

    const color = COLORS[level] ?? '';
    const text = format(message, ...args);
    console.log(`${timestamp()} - ${color}${level}\u001B[39m: ${text}`);
  }
}

/** Duck-typing check for `Logger` implementations (e.g. winston instances). */
export function isLogger(value: unknown): value is Logger {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['info', 'verbose', 'debug', 'error'].every(
      (method) => typeof (value as Record<string, unknown>)[method] === 'function'
    )
  );
}

/** Turn the `log` option into a logger. */
export function createLogger(option: unknown): Logger {
  if (isLogger(option)) {
    return option;
  }

  if (typeof option === 'string' && (LEVELS as readonly string[]).includes(option)) {
    return new ConsoleLogger(option as LogLevel);
  }

  return new ConsoleLogger(option ? 'info' : false);
}
