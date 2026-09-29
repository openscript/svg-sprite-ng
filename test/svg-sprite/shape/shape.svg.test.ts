import type { Element as XmlElement } from '@xmldom/xmldom';
import { describe, expect, it, vi } from 'vitest';
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

function createShape(svg = '<svg></svg>', config: SpriterConfig = {}): SvgShape {
  return new SvgShape(
    new SpriteFile({
      path: '/test_base/test.svg',
      base: '/test_base',
      contents: svg
    }),
    createContext(config)
  );
}

describe('SvgShape SVG serialization', () => {
  it('clones the root node when serializing a regular shape', () => {
    const shape = createShape();
    const cloneNodeSpy = vi.spyOn(shape.dom.documentElement!, 'cloneNode');

    shape.getSVG(false);

    expect(cloneNodeSpy).toHaveBeenCalledWith(true);
  });

  it('serializes distributed copies as <use> elements', () => {
    const master = createShape('<svg id="master"></svg>', {
      svg: { doctypeDeclaration: false, xmlDeclaration: false }
    });
    const shape = createShape('<svg></svg>', {
      svg: { doctypeDeclaration: false, xmlDeclaration: false }
    });
    shape.master = master;

    expect(shape.getSVG(false)).toBe(
      '<use xlink:href="#test" xmlns="http://www.w3.org/2000/svg"/>'
    );
  });

  it('strips redundant inline namespace declarations', () => {
    const shape = createShape(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g xmlns="http://www.w3.org/2000/svg"><use xlink:href="#a"/></g></svg>',
      { svg: { doctypeDeclaration: false, xmlDeclaration: false } }
    );

    expect(shape.getSVG(true)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><g><use xlink:href="#a"/></g></svg>'
    );
  });

  it('runs the transform callback on a clone before serialization', () => {
    const shape = createShape('<svg></svg>', {
      svg: { doctypeDeclaration: false, xmlDeclaration: false }
    });
    const transform = vi.fn<(element: XmlElement) => void>((element): void => {
      element.setAttribute('data-test', '1');
    });
    const svg = shape.getSVG(false, (element) => transform(element));

    expect(transform).toHaveBeenCalledTimes(1);
    expect(svg).toContain('data-test="1"');
  });

  it('prepends configured XML and DOCTYPE declarations', () => {
    const shape = createShape('<svg></svg>', {
      svg: {
        doctypeDeclaration: true,
        xmlDeclaration: true
      }
    });
    shape.doctypeDeclaration = 'TEST DOCTYPE DECLARATION';
    shape.xmlDeclaration = 'TEST XML DECLARATION';

    const svg = shape.getSVG(false);

    expect(svg).toContain('TEST DOCTYPE DECLARATION');
    expect(svg).toContain('TEST XML DECLARATION');
  });

  it('replaces the current SVG and reparses dimensions through setSVG', () => {
    const shape = createShape('<svg width="1" height="1"></svg>');
    shape.svg.ready = 'ready';

    shape.setSVG('<svg width="5" height="6"></svg>');

    expect(shape.svg.ready).toBeNull();
    expect(shape.getDimensions()).toStrictEqual({ width: 5, height: 6 });
  });

  it('rounds numbers using the configured precision', () => {
    const shape = createShape('<svg></svg>', {
      shape: {
        dimension: {
          precision: 0
        }
      }
    });

    expect(shape.round(99.9)).toBe(100);
  });
});
