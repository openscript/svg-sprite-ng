import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SvgSpriter } from '../../../src/index.ts';
import { SvgSpriteBase } from '../../../src/mode/base.ts';
import { SvgSprite } from '../../../src/sprite.ts';
import type { MergedModeConfig, ModeSettings } from '../../../src/mode/base.ts';
import type { Logger, ModeFiles, MustacheData, ShapeData } from '../../../src/types.ts';

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

function createShapeData(): ShapeData {
  return {
    name: 'weather-clear',
    base: 'weather-clear',
    master: null,
    width: { inner: 48, outer: 48 },
    height: { inner: 48, outer: 48 },
    first: true,
    last: true,
    fileSize: null,
    svg: '<svg id="weather-clear"/>',
    position: {
      absolute: { x: 0, y: 0, xy: '0 0' },
      relative: { x: 0, y: 0, xy: '0 0' }
    },
    selector: {
      shape: [
        { expression: '.icon-weather-clear', raw: '.icon-weather-clear', first: true, last: true }
      ],
      dimensions: [
        {
          expression: '.icon-weather-clear-dims',
          raw: '.icon-weather-clear-dims',
          first: true,
          last: true
        }
      ]
    },
    dimensions: { inline: false, extra: true }
  };
}

function createData(): MustacheData {
  return {
    shapes: [createShapeData()],
    date: new Date(0).toUTCString(),
    spriteWidth: 48,
    spriteHeight: 48,
    classname:
      () =>
      (value: string, render: (value: string) => string): string => {
        const rendered = render(value).replaceAll(/\s+/gu, ' ').trim();
        const classname = rendered.split(' ').pop() ?? '';
        return classname.startsWith('.') ? classname.slice(1) : classname;
      }
  };
}

class TestMode extends SvgSpriteBase {
  constructor(spriter: SvgSpriter, config: MergedModeConfig, data: MustacheData, key = 'custom') {
    super(spriter, config, data, key, 'css');
  }

  override async layout(files: ModeFiles): Promise<MustacheData> {
    await this.buildCssResources(files);
    return this.buildHtmlExample(files);
  }

  addUnitForTest(value: number, unit: string): string {
    return this.addUnit(value, unit);
  }

  addCacheBustingForTest(svg: SvgSprite): string {
    return this.addCacheBusting(svg);
  }
}

function createModeConfig(svg: ModeSettings['svg'], bust = false): MergedModeConfig {
  return {
    dest: 'styles',
    prefix: 'icon-',
    sprite: 'sprites/main',
    bust,
    svg,
    dimensions: true,
    render: {
      css: {
        dest: 'bundle'
      }
    },
    example: {
      dest: 'preview.html'
    }
  };
}

describe('SvgSpriteBase', () => {
  it('resolves mode paths, render targets and example metadata', () => {
    const logger = createLogger();
    const dest = path.resolve('test/.tmp-assignment/base/config');
    const spriter = new SvgSpriter({ dest, log: logger });
    const mode = new TestMode(spriter, createModeConfig(spriter.config.svg), createData());

    expect(mode.key).toBe('custom');
    expect(mode.mode).toBe('css');
    expect(mode.data['mode']).toBe('css');
    expect(mode.data['key']).toBe('custom');
    expect(mode.config.dest).toBe(path.resolve(dest, 'styles'));
    expect(mode.config.sprite).toBe(path.resolve(dest, 'styles/sprites/main.svg'));
    expect(mode.config.prefix).toBe('icon-%s');
    expect(mode.config.render['css']).toStrictEqual({
      template: path.resolve('tmpl/common/sprite.css'),
      dest: path.resolve(dest, 'styles/bundle.css')
    });
    expect(mode.config.example).toStrictEqual({
      template: path.resolve('tmpl/css/sprite.html'),
      dest: path.resolve(dest, 'styles/preview.html')
    });
    expect(mode.data['sprite']).toBe('sprites/main.svg');
    expect(mode.data['example']).toBe('sprites/main.svg');
    expect(logger.debug).toHaveBeenCalledWith(
      'Created «%s» sprite instance («%s» mode)',
      'custom',
      'css'
    );
  });

  it('renders configured stylesheet and example resources', async () => {
    const logger = createLogger();
    const dest = path.resolve('test/.tmp-assignment/base/resources');
    const spriter = new SvgSpriter({ dest, log: logger });
    const mode = new TestMode(spriter, createModeConfig(spriter.config.svg), createData());
    const files: ModeFiles = {};

    const returnedData = await mode.layout(files);

    expect(returnedData).toBe(mode.data);
    expect(files['css']?.path).toBe(path.resolve(dest, 'styles/bundle.css'));
    expect(files['css']?.contents.toString()).toContain('.icon-weather-clear-dims');
    expect(files['css']?.contents.toString()).toContain('width: 48px;');
    expect(files['example']?.path).toBe(path.resolve(dest, 'styles/preview.html'));
    expect(files['example']?.contents.toString()).toContain('SVG CSS sprite preview');
    expect(files['example']?.contents.toString()).toContain('weather-clear');
    expect(files['example']?.contents.toString()).toContain('sprites/main.svg');
    expect(logger.verbose).toHaveBeenCalledWith('Created «%s» stylesheet resource', 'css');
    expect(logger.verbose).toHaveBeenCalledWith('Created «%s» HTML example file', 'custom');
  });

  it('adds units, resolves declarations and cache-busts sprite paths', () => {
    const dest = path.resolve('test/.tmp-assignment/base/bust');
    const spriter = new SvgSpriter({ dest, log: false });
    const mode = new TestMode(spriter, createModeConfig(spriter.config.svg, true), createData());
    const svg = new SvgSprite('', '', {}, true);

    svg.add('<rect width="1" height="1"/>');

    expect(mode.addUnitForTest(0, 'px')).toBe('0');
    expect(mode.addUnitForTest(12.5, 'px')).toBe('12.5px');
    expect(mode.declaration(true, '<?xml version="1.0"?>')).toBe('<?xml version="1.0"?>');
    expect(mode.declaration(' <!DOCTYPE svg> ', undefined)).toBe('<!DOCTYPE svg>');
    expect(mode.declaration(undefined, undefined)).toBe('');

    const busted = mode.addCacheBustingForTest(svg);

    expect(busted).toMatch(/styles[\\/]sprites[\\/]main-[0-9a-f]{8}\.svg$/u);
    expect(mode.data['sprite']).toMatch(/^sprites\/main-[0-9a-f]{8}\.svg$/u);
    expect(mode.data['example']).toMatch(/^sprites\/main-[0-9a-f]{8}\.svg$/u);
  });
});
