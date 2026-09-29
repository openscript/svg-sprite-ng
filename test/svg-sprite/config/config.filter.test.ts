import { describe, expect, it } from 'vitest';
import { resolveModes } from '../../../src/config.ts';

describe('resolveModes', () => {
  const modes = ['stack', 'defs', 'view', 'css', 'symbol'] as const;

  it('returns an empty object when passed an empty object', () => {
    expect(resolveModes({})).toStrictEqual({});
  });

  it.each(modes)('keeps plain objects and fills in %s when mode is omitted', (mode) => {
    expect(resolveModes({ [mode]: {} })).toStrictEqual({ [mode]: { mode } });
    expect(resolveModes({ [mode]: true })).toStrictEqual({ [mode]: { mode } });
  });

  it.each(modes)('keeps plain objects when an explicit mode %s is provided', (mode) => {
    expect(resolveModes({ custom: { mode } })).toStrictEqual({ custom: { mode } });
  });

  it('drops entries with invalid mode settings', () => {
    expect(resolveModes({ nonsense: {} })).toStrictEqual({});
  });

  it.each(modes)('drops disabled %s entries', (mode) => {
    expect(resolveModes({ [mode]: false })).toStrictEqual({});
  });
});
