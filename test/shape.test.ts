import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it, vi } from 'vitest';
import { SvgSpriter } from '../src/index.ts';
import { calculateSvgDimensions } from '../src/utils/calculate-svg-dimensions.ts';
import { paths } from './helpers/constants.ts';

vi.mock('../src/utils/calculate-svg-dimensions.ts', () => ({
  calculateSvgDimensions: vi.fn<(svg: string) => Promise<{ width: number; height: number }>>()
}));

const calculateSvgDimensionsMock = vi.mocked(calculateSvgDimensions);
const TEST_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

const expectations = [
  { file: '46x46.svg', width: 46, height: 46 },
  { file: '2048x2048.svg', width: 2048, height: 2048 }
] as const;

describe('shape compilation without explicit dimensions', () => {
  it.each(expectations)(
    'complements $file using calculated dimensions',
    async ({ file, width, height }) => {
      calculateSvgDimensionsMock.mockResolvedValueOnce({ width, height });

      const spriter = new SvgSpriter({
        log: false,
        shape: {
          dest: 'svg',
          dimension: {
            maxWidth: 4000,
            maxHeight: 4000
          }
        },
        svg: {
          doctypeDeclaration: false
        }
      });

      const svgFilePath = path.join(paths.fixtures, 'svg/special/without-dims', file);
      spriter.add(svgFilePath, file, TEST_SVG);

      const { result } = await spriter.compile({});
      const [shapeFile] = result.shapes ?? [];

      expect(calculateSvgDimensionsMock).toHaveBeenCalledTimes(1);
      expect(calculateSvgDimensionsMock.mock.calls[0]?.[0]).toContain('<svg');
      expect(shapeFile).toBeDefined();

      const dom = new DOMParser().parseFromString(shapeFile?.contents.toString() ?? '', 'text/xml');

      expect(dom.documentElement?.getAttribute('height')).toBe(String(height));
      expect(dom.documentElement?.getAttribute('width')).toBe(String(width));
    }
  );
});
