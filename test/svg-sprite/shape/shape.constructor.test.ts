import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpriteFile, SvgShape, resolveConfig } from '../../../src/index.ts';
import type { ResolvedShapeMeta, SpriterConfig, SpriterContext } from '../../../src/types.ts';

function createContext(
  options: {
    config?: SpriterConfig;
    meta?: Record<string, ResolvedShapeMeta>;
    align?: Record<string, Record<string, number>>;
  } = {}
): SpriterContext {
  const resolved = resolveConfig({ log: false, ...options.config });

  return {
    config: {
      ...resolved,
      shape: {
        ...resolved.shape,
        meta: { ...resolved.shape.meta, ...options.meta },
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

function createFile(
  filePath = '/test_base/test_path.svg',
  base = '/test_base',
  svg = '<svg></svg>'
): SpriteFile {
  return new SpriteFile({ path: filePath, base, contents: svg });
}

describe('SvgShape constructor', () => {
  it('sets expected initial values from the source file and resolved config', () => {
    const source = createFile();
    const spriter = createContext();
    const shape = new SvgShape(source, spriter);

    expect(shape.spriter).toBe(spriter);
    expect(shape.source).toBe(source);
    expect(shape.name).toBe(path.basename(source.relative));
    expect(shape.id).toBe('test_path');
    expect(shape.base).toBe('test_path');
    expect(shape.state).toBeNull();
    expect(shape.master).toBeNull();
    expect(shape.copies).toBe(0);
    expect(shape.alignments).toStrictEqual([['%s', 0]]);
    expect(shape.round(1.239)).toBe(1.24);
  });

  it('keeps folder names in the default generated id', () => {
    const source = createFile('/my/full/path/folder/test path.f.svg', '/my/full/path');
    const shape = new SvgShape(source, createContext());

    expect(shape.id).toBe('folder--test_path.f');
  });

  it('supports string generators with custom separators', () => {
    const shape = new SvgShape(
      createFile(),
      createContext({
        config: {
          shape: {
            id: {
              generator: '%s-test',
              separator: '!'
            }
          }
        }
      })
    );

    expect(shape.config.id.generator(`test${path.sep}test.f.svg`, shape.source)).toBe(
      'test!test.f-test'
    );
    expect(shape.config.id.generator('test 1.svg', shape.source)).toBe('test_1-test');
  });

  it('uses generated ids to derive the base and state parts', () => {
    const shape = new SvgShape(
      createFile(),
      createContext({
        config: {
          shape: {
            id: {
              generator() {
                return 'icon~hover';
              }
            }
          }
        }
      })
    );

    expect(shape.id).toBe('icon~hover');
    expect(shape.base).toBe('icon');
    expect(shape.state).toBe('hover');
  });

  it('prefers meta keyed by generated id and falls back to the relative name', () => {
    const byId = new SvgShape(
      createFile(),
      createContext({
        config: {
          shape: {
            id: {
              generator() {
                return 'test-id';
              }
            }
          }
        },
        meta: {
          'test-id': { title: 'By id' },
          test_path: { title: 'By relative name' }
        }
      })
    );

    const byRelativeName = new SvgShape(
      createFile(),
      createContext({
        config: {
          shape: {
            id: {
              generator() {
                return 'different-id';
              }
            }
          }
        },
        meta: {
          test_path: { title: 'By relative name' }
        }
      })
    );

    expect(byId.meta).toStrictEqual({ title: 'By id' });
    expect(byRelativeName.meta).toStrictEqual({ title: 'By relative name' });
  });

  it('merges wildcard and shape-specific alignments into alignments', () => {
    const shape = new SvgShape(
      createFile(),
      createContext({
        align: {
          '*': { '%s': 0.25 },
          test_path: { 'copy %s': 0.75 }
        }
      })
    );

    expect(shape.alignments).toStrictEqual([
      ['%s', 0.25],
      ['copy %s', 0.75]
    ]);
  });
});
