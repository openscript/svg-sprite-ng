import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SvgShape } from '../../../src/shape.ts';
import type { Logger, SpriterContext } from '../../../src/types.ts';
import { DEFAULT_PLUGINS, svgoTransform } from '../../../src/transform/svgo.ts';
import { optimize } from 'svgo';

vi.mock('svgo', () => ({
  optimize: vi.fn<(svg: string, config: object) => { data: string }>()
}));

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

function createSpriter(
  xmlDeclaration: boolean,
  doctypeDeclaration: boolean
): SpriterContext & SpyLogger {
  return {
    ...createLogger(),
    config: {
      svg: {
        xmlDeclaration,
        doctypeDeclaration
      }
    },
    shapes: [],
    limit: 1
  } as unknown as SpriterContext & SpyLogger;
}

function createShape(initialSvg: string): { shape: SvgShape; read: () => string } {
  let current = initialSvg;
  const fakeShape: {
    name: string;
    getSVG: () => string;
    setSVG: (svg: string) => SvgShape;
  } = {
    name: 'icon.svg',
    getSVG: vi.fn<() => string>(() => current),
    setSVG: vi.fn<(svg: string) => SvgShape>((svg: string) => {
      current = svg;
      return fakeShape as unknown as SvgShape;
    })
  };

  return { shape: fakeShape as unknown as SvgShape, read: () => current };
}

describe('svgoTransform()', () => {
  const optimizeMock = vi.mocked(optimize);

  beforeEach(() => {
    optimizeMock.mockReset();
  });

  it('pins the old default plugin list explicitly for svgo 4', () => {
    expect(DEFAULT_PLUGINS).not.toContain('preset-default');
    expect(DEFAULT_PLUGINS).toEqual(
      expect.arrayContaining(['removeViewBox', 'removeTitle', 'removeDesc'])
    );
    expect(DEFAULT_PLUGINS.slice(-3)).toStrictEqual([
      'sortDefsChildren',
      'removeTitle',
      'removeDesc'
    ]);
  });

  it('optimizes a shape with the default plugin list plus XML and doctype removals', async () => {
    optimizeMock.mockReturnValue({ data: '<svg/>' });

    const spriter = createSpriter(false, false);
    const { shape, read } = createShape('<svg><!-- comment --></svg>');

    await svgoTransform(shape, {}, spriter);

    expect(optimizeMock).toHaveBeenCalledWith(
      '<svg><!-- comment --></svg>',
      expect.objectContaining({
        plugins: expect.arrayContaining([
          ...DEFAULT_PLUGINS,
          { name: 'removeXMLProcInst' },
          { name: 'removeDoctype' }
        ])
      })
    );
    expect(read()).toBe('<svg/>');
    expect(spriter.debug).toHaveBeenCalledWith(
      'Optimized "%s" with SVGO (saved %s / %s%%)',
      'icon.svg',
      expect.stringMatching(/(?:Bytes|kB|MB)$/u),
      expect.any(Number)
    );
  });

  it('prefers explicitly configured plugins when they are supplied', async () => {
    const plugins = [{ name: 'prefixIds' }] as const;

    optimizeMock.mockReturnValue({ data: '<svg/>' });

    const spriter = createSpriter(true, true);
    const { shape } = createShape('<svg></svg>');

    await svgoTransform(shape, { plugins: [...plugins] }, spriter);

    expect(optimizeMock).toHaveBeenCalledWith(
      '<svg></svg>',
      expect.objectContaining({ plugins: [...plugins] })
    );
  });

  it('logs and rethrows optimizer failures', async () => {
    const error = new Error('svgo failed');

    optimizeMock.mockImplementation(() => {
      throw error;
    });

    const spriter = createSpriter(true, true);
    const { shape } = createShape('<svg></svg>');

    await expect(svgoTransform(shape, {}, spriter)).rejects.toBe(error);
    expect(spriter.error).toHaveBeenCalledWith(
      'Optimizing "%s" with SVGO failed with error "%s"',
      'icon.svg',
      error
    );
  });
});
