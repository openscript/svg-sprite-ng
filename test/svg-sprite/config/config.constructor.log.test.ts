import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger, resolveConfig } from '../../../src/index.ts';
import type { Logger } from '../../../src/index.ts';

function createLoggerMock(): Logger {
  return {
    info: vi.fn<Logger['info']>(),
    verbose: vi.fn<Logger['verbose']>(),
    debug: vi.fn<Logger['debug']>(),
    error: vi.fn<Logger['error']>()
  };
}

describe('resolveConfig logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a custom logger instance', () => {
    const logger = createLoggerMock();
    const config = resolveConfig({ log: logger });

    expect(config.log).toBe(logger);
  });

  it('emits debug and verbose initialization messages with a custom logger', () => {
    const logger = createLoggerMock();

    resolveConfig({ log: logger });

    expect(logger.debug).toHaveBeenCalledTimes(6);
    expect(logger.debug).toHaveBeenNthCalledWith(1, 'Started logging');
    expect(logger.debug).toHaveBeenNthCalledWith(2, 'Prepared general options');
    expect(logger.debug).toHaveBeenNthCalledWith(3, 'Prepared `shape` options');
    expect(logger.debug).toHaveBeenNthCalledWith(4, 'Prepared `svg` options');
    expect(logger.debug).toHaveBeenNthCalledWith(5, 'Prepared `mode` options');
    expect(logger.debug).toHaveBeenNthCalledWith(6, 'Prepared `variables` options');
    expect(logger.verbose).toHaveBeenCalledTimes(1);
    expect(logger.verbose).toHaveBeenCalledWith('Initialized spriter configuration');
  });

  it.each([
    ['info', 'info', false],
    ['verbose', 'verbose', false],
    ['debug', 'debug', false],
    [true, 'info', false],
    [false, 'info', true]
  ] as const)('creates the default logger for log=%s', (log, level, silent) => {
    const logger = resolveConfig({ log }).log;

    expect(logger).toBeDefaultLogger();
    expect(logger).toBeInstanceOf(ConsoleLogger);
    if (!(logger instanceof ConsoleLogger)) {
      throw new TypeError('Expected ConsoleLogger');
    }

    expect(logger.level).toBe(level);
    expect(logger.silent).toBe(silent);
  });
});
