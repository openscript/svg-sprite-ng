import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../../src/index.ts';

describe('resolveConfig shape.spacing', () => {
  const defaultSpacing = {
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    box: 'content'
  } as const;

  it('defaults spacing when omitted', () => {
    expect(resolveConfig({ log: false }).shape.spacing).toStrictEqual(defaultSpacing);
    expect(resolveConfig({ shape: {}, log: false }).shape.spacing).toStrictEqual(defaultSpacing);
  });

  it('expands numeric padding to all sides', () => {
    const config = resolveConfig({ shape: { spacing: { padding: 1 } }, log: false });

    expect(config.shape.spacing).toStrictEqual({
      padding: { top: 1, right: 1, bottom: 1, left: 1 },
      box: 'content'
    });
  });

  it('clamps invalid numeric scalars to zero', () => {
    expect(
      resolveConfig({ shape: { spacing: { padding: -10 } }, log: false }).shape.spacing
    ).toStrictEqual(defaultSpacing);
  });

  it.each([
    [[10], { top: 10, right: 10, bottom: 10, left: 10 }],
    [[10, 5], { top: 10, right: 5, bottom: 10, left: 5 }],
    [[10, 5, 3], { top: 10, right: 5, bottom: 3, left: 5 }],
    [[10, 5, 3, 2], { top: 10, right: 5, bottom: 3, left: 2 }],
    [[-10, -5, -3, -2], { top: 0, right: 0, bottom: 0, left: 0 }]
  ] as const)('resolves array padding %j', (padding, expectedPadding) => {
    const config = resolveConfig({ shape: { spacing: { padding } }, log: false });

    expect(config.shape.spacing).toStrictEqual({ padding: expectedPadding, box: 'content' });
  });
});
