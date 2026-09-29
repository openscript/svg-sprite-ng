import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger, SvgSpriter, resolveConfig } from '../src/index.ts';
import type { Logger } from '../src/index.ts';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the console logger by default', () => {
    expect(resolveConfig().log).toBeDefaultLogger();
    expect(resolveConfig({ log: 'debug' }).log).toBeDefaultLogger();
    expect(resolveConfig({ log: false }).log).toBeDefaultLogger();
  });

  it('accepts a custom Logger (e.g. a winston instance)', () => {
    const logger: Logger = {
      info: vi.fn<Logger['info']>(),
      verbose: vi.fn<Logger['info']>(),
      debug: vi.fn<Logger['info']>(),
      error: vi.fn<Logger['info']>()
    };
    const spriter = new SvgSpriter({ log: logger });

    expect(spriter.config.log).toBe(logger);
    expect(logger.info).toHaveBeenCalledWith('Created spriter instance');
  });

  it('is silent when logging is disabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    new SvgSpriter({ log: false });

    expect(spy).not.toHaveBeenCalled();
  });

  it('filters messages by level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new ConsoleLogger('info');

    logger.info('hello %s', 'world');
    logger.verbose('hidden');
    logger.debug('hidden');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain('hello world');
  });
});
