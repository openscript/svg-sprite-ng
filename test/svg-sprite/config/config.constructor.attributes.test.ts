import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpriteFile, SvgShape, SvgSpriter, resolveConfig } from '../../../src/index.ts';
import type { ShapeSorter, SpriterContext } from '../../../src/index.ts';
import { paths } from '../../helpers/constants.ts';

const reverseSort: ShapeSorter = (shape1, shape2) => shape2.id.localeCompare(shape1.id);

function createShape(id: string): SvgShape {
  const config = resolveConfig({ log: false });
  const spriter: SpriterContext = {
    config,
    shapes: [],
    limit: 1,
    info() {},
    verbose() {},
    debug() {},
    error() {}
  };

  return new SvgShape(
    new SpriteFile({
      base: path.resolve('test/fixture/svg/single'),
      path: path.resolve('test/fixture/svg/single', `${id}.svg`),
      contents: '<svg />'
    }),
    spriter
  );
}

describe('resolveConfig general attributes', () => {
  it('resolves dest from config.dest', () => {
    const config = resolveConfig({ dest: paths.tmp, log: false });

    expect(config.dest).toBe(path.resolve(paths.tmp));
  });

  it('defaults dest to the current directory', () => {
    expect(resolveConfig({ log: false }).dest).toBe(path.resolve('.'));
  });

  it('clones variables from config.variables', () => {
    const variables = { test1: 1, test2: 2 };
    const config = resolveConfig({ variables, log: false });

    expect(config.variables).toStrictEqual(variables);
    expect(config.variables).not.toBe(variables);
  });
});

describe('resolveConfig shape.sort', () => {
  it('uses the provided sort function', () => {
    const config = resolveConfig({ shape: { sort: reverseSort }, log: false });

    expect(config.shape.sort).toBe(reverseSort);
  });

  it('defaults to sorting by increasing id', () => {
    const config = resolveConfig({ log: false });
    const shapes = [createShape('b'), createShape('a'), createShape('c')];

    expect(shapes.toSorted(config.shape.sort).map((shape) => shape.id)).toStrictEqual([
      'a',
      'b',
      'c'
    ]);
  });
});

describe('SvgSpriter#config', () => {
  it('stores the resolved configuration on the spriter instance', () => {
    const spriter = new SvgSpriter({ dest: paths.tmp, mode: { css: true }, log: false });

    expect(spriter.config.dest).toBe(path.resolve(paths.tmp));
    expect(spriter.config.mode['css']?.mode).toBe('css');
  });
});
