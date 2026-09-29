import { describe, expect, it } from 'vitest';
import { NotPermittedError, SpriteFile, SvgShape, resolveConfig } from '../../../src/index.ts';
import type { ResolvedShapeMeta, SpriterConfig, SpriterContext } from '../../../src/types.ts';

function createContext(
  options: {
    config?: SpriterConfig;
    meta?: ResolvedShapeMeta;
  } = {}
): SpriterContext {
  const resolved = resolveConfig({ log: false, ...options.config });

  return {
    config: {
      ...resolved,
      shape: {
        ...resolved.shape,
        meta: {
          ...resolved.shape.meta,
          test: options.meta ?? resolved.shape.meta.test ?? {}
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
      path: '/test_base/test.svg',
      base: '/test_base',
      contents: svg
    }),
    createContext(options)
  );
}

describe('SvgShape setNamespace/resetNamespace', () => {
  it('rejects namespace changes before complementing the shape', async () => {
    const shape = createShape('<svg width="1" height="1"></svg>', {
      config: {
        svg: {
          namespaceIDs: true,
          namespaceClassnames: true
        }
      }
    });

    await expect(shape.setNamespace('ns-')).rejects.toThrow(
      new NotPermittedError('Shape namespace cannot be set before complementing')
    );
  });

  it('namespaces ids, class names, aria-labelledby and references', async () => {
    const shape = createShape(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="abc" class="c1 c2" width="1" height="2"><style>.c1,#abc{fill:url(#abc)}</style><use xlink:href="#abc" href="#abc" style="fill:url(#abc)"/></svg>',
      {
        config: {
          svg: {
            doctypeDeclaration: false,
            xmlDeclaration: false,
            namespaceIDs: true,
            namespaceClassnames: true,
            namespaceIDPrefix: 'pre-'
          }
        },
        meta: {
          title: 'Title'
        }
      }
    );

    await shape.complement();
    await shape.setNamespace('ns-');

    expect(shape.getSVG(false)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="pre-ns-abc" class="ns-c1 ns-c2" width="1" height="2" viewBox="0 0 1 2" aria-labelledby="pre-ns-test-title"><title id="pre-ns-test-title">Title</title><style>.ns-c1,#pre-ns-abc{fill:url(#pre-ns-abc)}</style><use xlink:href="#pre-ns-abc" href="#pre-ns-abc" style="fill:url(#pre-ns-abc)"/></svg>'
    );
  });

  it('does not re-namespace an already namespaced shape', async () => {
    const shape = createShape('<svg width="1" height="1" id="abc"></svg>', {
      config: {
        svg: {
          doctypeDeclaration: false,
          xmlDeclaration: false,
          namespaceIDs: true,
          namespaceClassnames: false,
          namespaceIDPrefix: 'pre-'
        }
      }
    });

    await shape.complement();
    await shape.setNamespace('ns-');
    const namespaced = shape.getSVG(false);

    await shape.setNamespace('other-');

    expect(shape.getSVG(false)).toBe(namespaced);
  });

  it('restores the pre-namespaced ready SVG when resetting namespace ids', async () => {
    const shape = createShape(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="abc" class="c1 c2" width="1" height="2"><style>.c1,#abc{fill:url(#abc)}</style><use xlink:href="#abc" href="#abc" style="fill:url(#abc)"/></svg>',
      {
        config: {
          svg: {
            doctypeDeclaration: false,
            xmlDeclaration: false,
            namespaceIDs: true,
            namespaceClassnames: true,
            namespaceIDPrefix: 'pre-'
          }
        },
        meta: {
          title: 'Title'
        }
      }
    );

    await shape.complement();
    const beforeNamespace = shape.getSVG(false);
    await shape.setNamespace('ns-');

    shape.resetNamespace();

    expect(shape.getSVG(false)).toBe(beforeNamespace);
  });

  it('leaves class-only namespacing untouched when resetting without namespace ids', async () => {
    const shape = createShape('<svg width="1" height="1" class="c1"></svg>', {
      config: {
        svg: {
          doctypeDeclaration: false,
          xmlDeclaration: false,
          namespaceIDs: false,
          namespaceClassnames: true
        }
      }
    });

    await shape.complement();
    await shape.setNamespace('ns-');
    const namespaced = shape.getSVG(false);

    shape.resetNamespace();

    expect(shape.getSVG(false)).toBe(namespaced);
  });
});
