import { describe, expect, it, vi } from 'vitest';
import { SvgSpriter } from '../../../src/index.ts';
import { SvgSpriteLayouter } from '../../../src/layouter.ts';

class TestError extends Error {}

describe('svg-sprite: errors', () => {
  it('should throw error if compilation has failed with configured modes', async () => {
    expect.hasAssertions();

    const layoutSpy = vi
      .spyOn(SvgSpriteLayouter.prototype, 'layout')
      .mockRejectedValue(new TestError());
    const spriter = new SvgSpriter({
      log: false,
      shape: {
        dest: 'svg'
      },
      mode: {
        symbol: true
      }
    });

    await expect(spriter.compile()).rejects.toThrow(TestError);
    expect(layoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw error if compilation has failed with explicit mode arguments', async () => {
    expect.hasAssertions();

    const layoutSpy = vi
      .spyOn(SvgSpriteLayouter.prototype, 'layout')
      .mockRejectedValue(new TestError());
    const spriter = new SvgSpriter({
      log: false,
      shape: {
        dest: 'svg'
      }
    });

    await expect(
      spriter.compile({
        symbol: true
      })
    ).rejects.toThrow(TestError);
    expect(layoutSpy).toHaveBeenCalledTimes(1);
  });
});
