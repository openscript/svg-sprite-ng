import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, vi } from 'vitest';
import { SpriteFile, SvgShape, resolveConfig } from '../../../src/index.ts';
import { calculateSvgDimensions } from '../../../src/utils/calculate-svg-dimensions.ts';
import type { ResolvedShapeMeta, SpriterConfig, SpriterContext } from '../../../src/types.ts';

vi.mock('../../../src/utils/calculate-svg-dimensions.ts', () => ({
  calculateSvgDimensions: vi.fn<(svg: string) => Promise<{ width: number; height: number }>>()
}));

const calculateSvgDimensionsMock = vi.mocked(calculateSvgDimensions);

function createContext(
  options: { config?: SpriterConfig; meta?: ResolvedShapeMeta } = {}
): SpriterContext {
  const resolved = resolveConfig({ log: false, ...options.config });

  return {
    config: {
      ...resolved,
      shape: {
        ...resolved.shape,
        meta: {
          ...resolved.shape.meta,
          test_path: options.meta ?? resolved.shape.meta.test_path ?? {}
        }
      }
    },
    shapes: [],
    limit: 1,
    info() {},
    verbose() {},
    debug() {},
    error() {}
  };
}

function createShape(
  svg: string,
  options: { config?: SpriterConfig; meta?: ResolvedShapeMeta } = {}
): SvgShape {
  return new SvgShape(
    new SpriteFile({
      path: '/test_base/test_path.svg',
      base: '/test_base',
      contents: svg
    }),
    createContext(options)
  );
}

describe('SvgShape complement()', () => {
  it('derives dimensions from the viewBox when width and height are missing', async () => {
    const shape = createShape('<svg viewBox="0 0 12 8"></svg>');

    await shape.complement();

    expect(shape.getDimensions()).toStrictEqual({ width: 12, height: 8 });
    expect(shape.getViewbox()).toStrictEqual([0, 0, 12, 8]);
    expect(shape.svg.ready).toBe('<svg viewBox="0 0 12 8" width="12" height="8"/>');
  });

  it('uses calculateSvgDimensions when neither dimensions nor viewBox are present', async () => {
    calculateSvgDimensionsMock.mockResolvedValueOnce({ width: 46, height: 69 });
    const shape = createShape('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    await shape.complement();

    expect(calculateSvgDimensionsMock).toHaveBeenCalledTimes(1);
    expect(shape.getDimensions()).toStrictEqual({ width: 46, height: 69 });
    expect(shape.getViewbox()).toStrictEqual([0, 0, 46, 69]);
  });

  it('adds configured padding and metadata labels', async () => {
    const shape = createShape('<svg width="300" height="100" aria-labelledby="old"></svg>', {
      config: {
        shape: {
          spacing: {
            box: 'padding',
            padding: [10, 20, 30, 40]
          }
        }
      },
      meta: {
        title: 'Title',
        description: 'Description'
      }
    });

    await shape.complement();

    expect(shape.getDimensions()).toStrictEqual({ width: 360, height: 140 });
    expect(shape.getViewbox()).toStrictEqual([-40, -10, 360, 140]);
    expect(shape.dom.documentElement?.getAttribute('aria-labelledby')).toBe(
      'test_path-desc test_path-title'
    );
    expect(shape.title?.textContent).toBe('Title');
    expect(shape.description?.textContent).toBe('Description');
  });

  it('scales and centers icon-box shapes inside the configured bounds', async () => {
    const shape = createShape('<svg width="600" height="100"></svg>', {
      config: {
        shape: {
          spacing: {
            box: 'icon'
          },
          dimension: {
            maxWidth: 300,
            maxHeight: 100
          }
        }
      }
    });

    await shape.complement();

    expect(shape.getDimensions()).toStrictEqual({ width: 300, height: 100 });
    expect(shape.getViewbox()).toStrictEqual([0, -50, 600, 200]);
    expect(shape.config.spacing.padding).toStrictEqual({ top: 25, right: 0, bottom: 25, left: 0 });
  });

  it('removes stale aria-labelledby when no metadata remains', async () => {
    const shape = createShape('<svg width="1" height="1" aria-labelledby="old"></svg>');

    await shape.complement();

    const dom = new DOMParser().parseFromString(shape.getSVG(false), 'text/xml');
    expect(dom.documentElement?.hasAttribute('aria-labelledby')).toBe(false);
  });
});
