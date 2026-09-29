import { describe, expect, expectTypeOf, it } from 'vitest';
import { resolveConfig } from '../src/index.ts';
import type {
  CssModeConfig,
  Logger,
  ModeMap,
  ResolvedConfig,
  SpriterConfig,
  SpriteResult,
  SpriteFile
} from '../src/index.ts';

describe('config types', () => {
  it('resolveConfig accepts a SpriterConfig and returns a ResolvedConfig', () => {
    expectTypeOf(resolveConfig).parameter(0).toEqualTypeOf<SpriterConfig | undefined>();
    expectTypeOf(resolveConfig).returns.toEqualTypeOf<ResolvedConfig>();
  });

  it('allows the `true` shorthand for modes', () => {
    expectTypeOf<{ css: true }>().toExtend<ModeMap>();
    expectTypeOf<{ css: CssModeConfig }>().toExtend<ModeMap>();
    expectTypeOf<{ css: false }>().toExtend<ModeMap>();
  });

  it('rejects unknown option shapes', () => {
    expectTypeOf<{ dest: number }>().not.toExtend<SpriterConfig>();
    expectTypeOf<{ mode: { css: { layout: 'sideways' } } }>().not.toExtend<SpriterConfig>();
  });

  it('produces a fully resolved, readonly configuration', () => {
    const config = resolveConfig({ log: false, mode: { css: true, symbol: { inline: true } } });

    expectTypeOf(config.dest).toBeString();
    expectTypeOf(config.log).toEqualTypeOf<Logger>();
    expect(Object.keys(config.mode)).toStrictEqual(['css', 'symbol']);
    expect(config.mode['css']?.mode).toBe('css');
    expect(config.shape.spacing.padding).toStrictEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('types the compilation result', () => {
    expectTypeOf<SpriteResult['shapes']>().toEqualTypeOf<SpriteFile[] | undefined>();
  });
});
