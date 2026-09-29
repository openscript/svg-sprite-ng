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

function createShape(svg: string, config: SpriterConfig): SvgShape {
  return new SvgShape(
    new SpriteFile({
      path: '/test_base/test.svg',
      base: '/test_base',
      contents: svg
    }),
    createContext(config)
  );
}

describe('SvgShape reference rewriting', () => {
  it('rewrites ids, class names and url() references inside styles', async () => {
    const shape = createShape(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><defs><style>#marker,.cls1,.x{fill:url(#paint)}.other{fill:url(id2)}</style><linearGradient id="paint"/></defs><rect id="marker" class="cls1 x" style="fill:url(#paint)"/></svg>',
      {
        svg: {
          doctypeDeclaration: false,
          xmlDeclaration: false,
          namespaceIDs: true,
          namespaceClassnames: true,
          namespaceIDPrefix: 'p-'
        }
      }
    );

    await shape.complement();
    await shape.setNamespace('ns-');

    expect(shape.getSVG(false)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><defs><style>#p-ns-marker,.ns-cls1,.ns-x{fill:url(#p-ns-paint)}.other{fill:url(id2)}</style><linearGradient id="p-ns-paint"/></defs><rect id="p-ns-marker" class="ns-cls1 ns-x" style="fill:url(#p-ns-paint)"/></svg>'
    );
  });

  it('rewrites href and xlink:href references to namespaced ids', async () => {
    const shape = createShape(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="abc" width="1" height="2"><use href="#abc"/><use xlink:href="#abc"/></svg>',
      {
        svg: {
          doctypeDeclaration: false,
          xmlDeclaration: false,
          namespaceIDs: true,
          namespaceClassnames: false,
          namespaceIDPrefix: 'prefix-'
        }
      }
    );

    await shape.complement();
    await shape.setNamespace('ns-');

    expect(shape.getSVG(false)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="prefix-ns-abc" width="1" height="2" viewBox="0 0 1 2"><use href="#prefix-ns-abc"/><use xlink:href="#prefix-ns-abc"/></svg>'
    );
  });
});
