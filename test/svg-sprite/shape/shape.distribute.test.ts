import { describe, expect, it } from 'vitest';
import { SpriteFile, SvgShape, resolveConfig } from '../../../src/index.ts';
import type { SpriterConfig, SpriterContext } from '../../../src/types.ts';

function createContext(
  options: { config?: SpriterConfig; align?: Record<string, Record<string, number>> } = {}
): SpriterContext {
  const resolved = resolveConfig({ log: false, ...options.config });

  return {
    config: {
      ...resolved,
      shape: {
        ...resolved.shape,
        align: { ...resolved.shape.align, ...options.align }
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

function createShape(context: SpriterContext): SvgShape {
  return new SvgShape(
    new SpriteFile({
      path: '/test_base/test_path.svg',
      base: '/test_base',
      contents: '<svg></svg>'
    }),
    context
  );
}

describe('SvgShape distribution', () => {
  it('updates the current shape for the primary alignment', () => {
    const shape = createShape(createContext());

    const [distributed] = shape.distribute();

    expect(distributed).toBe(shape);
    expect(shape.base).toBe('test_path');
    expect(shape.id).toBe('test_path');
    expect(shape.align).toBe(0);
    expect(shape.copies).toBe(0);
  });

  it('creates linked copies for additional alignments and keeps the pseudo state', () => {
    const shape = createShape(
      createContext({
        align: {
          '*': {
            '%s': 0,
            'copy %s': 0.5,
            'shadow %s': 1
          }
        }
      })
    );
    shape.state = 'hover';

    const [primary, copy, shadow] = shape.distribute();

    expect(primary).toBeDefined();

    expect(primary).toBe(shape);
    expect(primary!.id).toBe('test_path~hover');
    expect(copy?.base).toBe('copy test_path');
    expect(copy?.id).toBe('copy test_path~hover');
    expect(copy?.align).toBe(0.5);
    expect(copy?.master).toBe(shape);
    expect(shadow?.base).toBe('shadow test_path');
    expect(shadow?.id).toBe('shadow test_path~hover');
    expect(shadow?.align).toBe(1);
    expect(shadow?.master).toBe(shape);
    expect(shape.copies).toBe(2);
  });
});
