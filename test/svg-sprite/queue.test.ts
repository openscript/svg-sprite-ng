import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SpriteFile } from '../../src/file.ts';
import { SvgSpriterQueue } from '../../src/queue.ts';
import { resolveConfig } from '../../src/config.ts';
import type { Logger, ResolvedConfig, ShapeTransformer, SpriterContext } from '../../src/types.ts';

const testSvg = path.resolve('test/fixture/svg/single/weather-clear.svg');
const testSvgContents = fs.readFileSync(testSvg);

function createContext(
  config: ResolvedConfig,
  logger?: Partial<Logger>
): SpriterContext & { shapes: unknown[] } {
  return {
    config,
    shapes: [],
    limit: 1,
    info: logger?.info ?? vi.fn<Logger['info']>(),
    verbose: logger?.verbose ?? vi.fn<Logger['verbose']>(),
    debug: logger?.debug ?? vi.fn<Logger['debug']>(),
    error: logger?.error ?? vi.fn<Logger['error']>()
  };
}

describe('SvgSpriterQueue', () => {
  it('starts empty and logs its creation', () => {
    const debug = vi.fn<Logger['debug']>();
    const queue = new SvgSpriterQueue(createContext(resolveConfig({ log: false }), { debug }));

    expect(queue.active).toBe(0);
    expect(debug).toHaveBeenCalledWith('Created processing queue instance');
  });

  it('tracks active work until queued processing settles', async () => {
    let release: (() => void) | undefined;
    const transform = vi.fn<ShapeTransformer>(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const debug = vi.fn<Logger['debug']>();
    const context = createContext(
      resolveConfig({ shape: { transform: [transform] }, log: false }),
      {
        debug
      }
    );
    const queue = new SvgSpriterQueue(context);

    queue.add(
      new SpriteFile({
        base: path.dirname(testSvg),
        path: testSvg,
        contents: testSvgContents
      })
    );

    expect(queue.active).toBe(1);
    expect(debug).toHaveBeenLastCalledWith('Added "%s" to processing queue', 'weather-clear.svg');

    release?.();
    await queue.idle();

    expect(queue.active).toBe(0);
    expect(context.shapes).toHaveLength(1);
    expect(transform).toHaveBeenCalledTimes(1);
  });

  it('logs and skips invalid SVG files', async () => {
    const error = vi.fn<Logger['error']>();
    const context = createContext(resolveConfig({ log: false }), { error });
    const queue = new SvgSpriterQueue(context);

    queue.add(
      new SpriteFile({
        base: path.dirname(testSvg),
        path: path.join(path.dirname(testSvg), 'broken.svg'),
        contents: 'not an svg'
      })
    );

    await queue.idle();

    expect(queue.active).toBe(0);
    expect(context.shapes).toHaveLength(0);
    expect(error).toHaveBeenCalledWith('Skipping "%s" (%s)', 'broken.svg', 'Invalid SVG file');
  });
});
