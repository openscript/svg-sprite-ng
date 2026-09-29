import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SvgSpriter } from '../../src/index.ts';
import type { Logger, ModeFiles } from '../../src/types.ts';
import { addFixtureFiles } from '../helpers/add-files.ts';
import { constants } from '../helpers/test-configs.ts';

interface SpyLogger extends Logger {
  info: ReturnType<typeof vi.fn<Logger['info']>>;
  verbose: ReturnType<typeof vi.fn<Logger['verbose']>>;
  debug: ReturnType<typeof vi.fn<Logger['debug']>>;
  error: ReturnType<typeof vi.fn<Logger['error']>>;
}

function createLogger(): SpyLogger {
  return {
    info: vi.fn<Logger['info']>(),
    verbose: vi.fn<Logger['verbose']>(),
    debug: vi.fn<Logger['debug']>(),
    error: vi.fn<Logger['error']>()
  };
}
function getModeFiles(entry: ModeFiles | readonly unknown[] | undefined): ModeFiles {
  if (!entry || Array.isArray(entry)) {
    throw new TypeError('Expected mode files');
  }

  return entry as ModeFiles;
}

describe('SvgSpriteLayouter via SvgSpriter.compile()', () => {
  it('merges mode config and variables into css layout data', async () => {
    const logger = createLogger();
    const dest = path.resolve('test/.tmp-assignment/layouter/custom');
    const spriter = new SvgSpriter({
      dest,
      log: logger,
      variables: { fromConfig: 'config-value' }
    });

    addFixtureFiles(spriter, constants.DEFAULT.files.slice(0, 2), constants.DEFAULT.cwd);

    const { result, data } = await spriter.compile({
      custom: {
        mode: 'css',
        dest: 'styles',
        sprite: 'sprites/main',
        prefix: 'icon-',
        dimensions: '--dims',
        common: '.all-icons',
        mixin: true,
        render: {
          css: {
            dest: 'bundle'
          }
        },
        example: {
          dest: 'preview.html'
        },
        variables: { fromMode: 'mode-value' }
      }
    });

    expect(logger.info).toHaveBeenCalledWith('Laying out «%s» sprite («%s» mode)', 'custom', 'css');

    const files = getModeFiles(result['custom']);

    expect(files['sprite']?.path).toMatch(/styles[\\/]sprites[\\/]main-[0-9a-f]{8}\.svg$/u);
    expect(files['css']?.path).toBe(path.resolve(dest, 'styles/bundle.css'));
    expect(files['example']?.path).toBe(path.resolve(dest, 'styles/preview.html'));
    expect(files['sprite']?.contents.toString()).toContain('<svg');
    expect(files['css']?.contents.toString()).toContain('icon-weather-clear--dims');

    const cssData = data['custom'];
    expect(cssData).toBeDefined();
    expect(cssData?.['fromConfig']).toBe('config-value');
    expect(cssData?.['fromMode']).toBe('mode-value');
    expect(cssData?.['common']).toBe('.all-icons');
    expect(cssData?.['hasCommon']).toBe(true);
    expect(cssData?.['mixinName']).toBe('.all-icons');
    expect(cssData?.['hasMixin']).toBe(true);
    expect(cssData?.['sprite']).toMatch(/^sprites\/main-[0-9a-f]{8}\.svg$/u);
    expect(cssData?.['example']).toMatch(/^sprites\/main-[0-9a-f]{8}\.svg$/u);
    const shapes = cssData?.['shapes'] ?? [];

    expect(shapes).toHaveLength(2);
    expect(shapes.map((shape) => shape.fileSize)).toStrictEqual([null, null]);
    expect(shapes[0]?.first).toBe(true);
    expect(shapes[1]?.last).toBe(true);
    expect(shapes[0]?.selector?.dimensions?.[0]?.expression).toBe('icon-weather-clear--dims');

    const classname = cssData?.['classname'] as () => (
      value: string,
      render: (value: string) => string
    ) => string;
    const escape = cssData?.['escape'] as () => (
      value: string,
      render: (value: string) => string
    ) => string;
    const encodeHashSign = cssData?.['encodeHashSign'] as () => (
      value: string,
      render: (value: string) => string
    ) => string;
    const invert = cssData?.['invert'] as () => (
      value: string,
      render: (value: string) => string
    ) => number;

    expect(classname()('alpha .omega', (value) => value)).toBe('omega');
    expect(escape()('\\1\\2', (value) => value)).toBe('\\\\1\\\\2');
    expect(encodeHashSign()('#hash', (value) => value)).toBe('%23hash');
    expect(invert()('3.5', (value) => value)).toBe(-3.5);
  });

  it('creates all supported mode instances through compile()', async () => {
    const dest = path.resolve('test/.tmp-assignment/layouter/modes');
    const spriter = new SvgSpriter({ dest, log: false });

    addFixtureFiles(spriter, constants.DEFAULT.files.slice(0, 2), constants.DEFAULT.cwd);

    const { result, data } = await spriter.compile({
      css: true,
      defs: { example: true },
      symbol: { inline: true },
      stack: { rootviewbox: false },
      view: true
    });

    expect(Object.keys(result).toSorted()).toStrictEqual([
      'css',
      'defs',
      'stack',
      'symbol',
      'view'
    ]);
    expect(Object.keys(data).toSorted()).toStrictEqual(['css', 'defs', 'stack', 'symbol', 'view']);

    const defsFiles = getModeFiles(result['defs']);
    const symbolFiles = getModeFiles(result['symbol']);
    const stackFiles = getModeFiles(result['stack']);
    const viewFiles = getModeFiles(result['view']);

    expect(defsFiles['sprite']?.contents.toString()).toContain('<defs>');
    expect(defsFiles['example']?.contents.toString()).toContain('SVG &lt;defs&gt; sprite preview');
    expect(symbolFiles['sprite']?.contents.toString()).toContain('<symbol');
    const stackSvg = stackFiles['sprite']?.contents.toString() ?? '';

    expect(/^<\?xml[^>]*\?><svg[^>]* viewBox=/u.test(stackSvg)).toBe(false);
    expect(viewFiles['sprite']?.contents.toString()).toContain('<view id="weather-clear"');
    expect(data['defs']?.['shapes'].every((shape) => shape.master === null)).toBe(true);
  });
});
