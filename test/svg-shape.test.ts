import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'tinyglobby';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArgumentError, SpriteFile, SvgShape, resolveConfig } from '../src/index.ts';
import { fixXmlString } from '../src/utils/fix-xml-string.ts';
import type { SpriterConfig, SpriterContext } from '../src/types.ts';
import { paths } from './helpers/constants.ts';

vi.mock('../src/utils/fix-xml-string.ts', () => ({
  fixXmlString: vi.fn<(svgString: string) => string>()
}));

const fixXmlStringMock = vi.mocked(fixXmlString);
const TEST_SVG = `<svg viewBox="0 0
                                16 16"></svg>`;
const FIXED_TEST_SVG = '<svg viewBox="0 0 16 16"></svg>';

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
      path: path.join(paths.fixtures, 'virtual.svg'),
      base: paths.fixtures,
      contents: svg
    }),
    createContext({
      shape: {
        dest: 'svg'
      }
    })
  );
}

describe('SVGShape initialization', () => {
  beforeEach(() => {
    fixXmlStringMock.mockReset();
  });

  it('repairs invalid svg strings through fixXmlString', () => {
    fixXmlStringMock.mockReturnValueOnce(FIXED_TEST_SVG);

    expect(() => createShape(TEST_SVG)).not.toThrow(ArgumentError);
    expect(fixXmlStringMock).toHaveBeenCalledWith(TEST_SVG);
  });

  it('throws when fixXmlString cannot repair the source', () => {
    fixXmlStringMock.mockImplementationOnce(() => {
      throw new Error('some error');
    });

    expect(() => createShape(TEST_SVG)).toThrow(new ArgumentError('Invalid SVG file'));
    expect(fixXmlStringMock).toHaveBeenCalledWith(TEST_SVG);
  });

  it('tries fixXmlString for non-svg input before failing', () => {
    const invalidMarkup = '<div class="test">123</div>';

    expect(() => createShape(invalidMarkup)).toThrow(ArgumentError);
    expect(fixXmlStringMock).toHaveBeenCalledWith(invalidMarkup);
  });

  it('does not call fixXmlString for valid fixture SVGs', () => {
    const cwd = path.join(paths.fixtures, 'svg/single');
    const weatherFiles = globSync('**/weather*.svg', { cwd });

    expect(weatherFiles.length).toBeGreaterThan(0);

    for (const weatherFile of weatherFiles) {
      const svg = fs.readFileSync(path.join(cwd, weatherFile), 'utf8');

      expect(() => createShape(svg)).not.toThrow(ArgumentError);
    }

    expect(fixXmlStringMock).not.toHaveBeenCalled();
  });
});
