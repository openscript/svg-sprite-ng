import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ArgumentError, SpriteFile, SvgShape, resolveConfig } from '../../../src/index.ts';
import { fixXmlString } from '../../../src/utils/fix-xml-string.ts';
import type { SpriterConfig, SpriterContext } from '../../../src/types.ts';
import { paths } from '../../helpers/constants.ts';

vi.mock('../../../src/utils/fix-xml-string.ts', () => ({
  fixXmlString: vi.fn<(svgString: string) => string>()
}));

const fixXmlStringMock = vi.mocked(fixXmlString);

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

function createShape(svg: string): SvgShape {
  return new SvgShape(
    new SpriteFile({
      path: '/test_base/test_path.svg',
      base: '/test_base',
      contents: svg
    }),
    createContext()
  );
}

describe('SvgShape SVG parsing', () => {
  it('uses fixXmlString for malformed SVG input', () => {
    fixXmlStringMock.mockReturnValueOnce('<svg></svg>');

    expect(() => createShape('s')).not.toThrow();
    expect(fixXmlStringMock).toHaveBeenCalledWith('s');
  });

  it('throws if the repaired SVG is still invalid', () => {
    fixXmlStringMock.mockReturnValueOnce('<');

    expect(() => createShape('s')).toThrow(new ArgumentError('Invalid SVG file'));
    expect(fixXmlStringMock).toHaveBeenCalledWith('s');
  });

  it('throws if fixXmlString itself fails', () => {
    fixXmlStringMock.mockImplementationOnce(() => {
      throw new Error('error');
    });

    expect(() => createShape('s')).toThrow(new ArgumentError('Invalid SVG file'));
    expect(fixXmlStringMock).toHaveBeenCalledWith('s');
  });

  it('resolves XML entities inside the source SVG', () => {
    const svg = fs.readFileSync(path.join(paths.fixtures, 'svg/special/with-entity.svg'), 'utf8');
    const shape = createShape(svg);

    expect(shape.svg.current).toContain('fill:#000000;');
  });

  it('throws on invalid parsed SVG content', () => {
    expect(() => createShape('<<ddfasdfasdf>>')).toThrow(ArgumentError);
  });

  it('reads width, height, viewBox, title and description from the document', () => {
    const shape = createShape(
      '<svg width="200" height="100" viewBox="0 1 2 3 4 5 20d ten"><title>test title</title><desc>test description</desc></svg>'
    );
    expect(shape.viewBox).not.toBe(false);
    const viewBox = shape.viewBox === false ? [] : [...shape.viewBox];

    expect(shape.width).toBe(200);
    expect(shape.height).toBe(100);
    expect(viewBox.slice(0, 7)).toStrictEqual([0, 1, 2, 3, 4, 5, 20]);
    expect(Number.isNaN(viewBox[7])).toBe(true);
    expect(shape.title?.textContent).toBe('test title');
    expect(shape.description?.textContent).toBe('test description');
  });

  it('fills short viewBoxes with trailing zeros', () => {
    const shape = createShape('<svg viewBox="0 1"></svg>');

    expect(shape.viewBox).toStrictEqual([0, 1, 0, 0]);
  });
});
