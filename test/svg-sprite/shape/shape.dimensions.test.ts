import { describe, expect, it } from 'vitest';
import { SpriteFile, SvgShape, resolveConfig } from '../../../src/index.ts';
import type { SpriterConfig, SpriterContext } from '../../../src/types.ts';

function createContext(config: SpriterConfig = {}): SpriterContext {
  const resolved = resolveConfig({ log: false, ...config });

  return {
    config: resolved,
    shapes: [],
    limit: 1,
    info() {},
    verbose() {},
    debug() {},
    error() {}
  };
}

function createShape(svg = '<svg></svg>'): SvgShape {
  return new SvgShape(
    new SpriteFile({
      path: '/test_base/test.svg',
      base: '/test_base',
      contents: svg
    }),
    createContext()
  );
}

describe('SvgShape dimensions API', () => {
  it('returns width and height through getDimensions', () => {
    const shape = createShape('<svg width="100" height="200"></svg>');

    expect(shape.getDimensions()).toStrictEqual({ width: 100, height: 200 });
  });

  it('updates width and height attributes through setDimensions', () => {
    const shape = createShape();

    shape.setDimensions(200, 100);

    expect(shape.width).toBe(200);
    expect(shape.height).toBe(100);
    expect(shape.dom.documentElement?.getAttribute('width')).toBe('200');
    expect(shape.dom.documentElement?.getAttribute('height')).toBe('100');
  });

  it('creates a viewBox from the current or provided dimensions when absent', () => {
    const shape = createShape('<svg width="10" height="20"></svg>');

    expect(shape.getViewbox()).toStrictEqual([0, 0, 10, 20]);
    expect(shape.setViewbox([])).toStrictEqual([0, 0, 0, 0]);
    expect(shape.getViewbox(30, 40)).toStrictEqual([0, 0, 0, 0]);
  });

  it('sets the viewBox from an array or explicit coordinates', () => {
    const shape = createShape();

    expect(shape.setViewbox([0, 1, 2, 3, 4, 23, Number.NaN])).toStrictEqual([
      0,
      1,
      2,
      3,
      4,
      23,
      Number.NaN
    ]);
    expect(shape.dom.documentElement?.getAttribute('viewBox')).toBe('0 1 2 3 4 23 NaN');
    expect(shape.setViewbox(0, 1, 2, 3)).toStrictEqual([0, 1, 2, 3]);
    expect(shape.dom.documentElement?.getAttribute('viewBox')).toBe('0 1 2 3');
  });
});
