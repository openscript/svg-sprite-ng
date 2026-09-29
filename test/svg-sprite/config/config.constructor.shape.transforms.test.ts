import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../../../src/index.ts';
import type { ShapeTransformer } from '../../../src/types.ts';

describe('resolveConfig shape.transform', () => {
  const defaultTransforms = [['svgo', {}]] as const;

  it('defaults transforms when omitted or null', () => {
    expect(resolveConfig({ shape: {}, log: false }).shape.transform).toStrictEqual(
      defaultTransforms
    );
  });

  it('converts string transforms to [name, {}] tuples', () => {
    const transforms = ['test', 'test_2'] as const;

    expect(
      resolveConfig({ shape: { transform: [...transforms] }, log: false }).shape.transform
    ).toStrictEqual([
      ['test', {}],
      ['test_2', {}]
    ]);
  });

  it('converts function transforms to custom tuples', () => {
    const transform1 = vi.fn<ShapeTransformer>();
    const transform2 = vi.fn<ShapeTransformer>();

    expect(
      resolveConfig({ shape: { transform: [transform1, transform2] }, log: false }).shape.transform
    ).toStrictEqual([
      ['custom', transform1],
      ['custom', transform2]
    ]);
  });

  it('keeps the first valid entry from transform objects', () => {
    const transform = vi.fn<ShapeTransformer>();
    const transformConfig = { test: 2 };

    expect(
      resolveConfig({
        shape: {
          transform: [
            { TEST: transform, IGNORED: vi.fn<ShapeTransformer>() },
            { TEST_2: transformConfig }
          ]
        },
        log: false
      }).shape.transform
    ).toStrictEqual([
      ['TEST', transform],
      ['TEST_2', transformConfig]
    ]);
  });
});
