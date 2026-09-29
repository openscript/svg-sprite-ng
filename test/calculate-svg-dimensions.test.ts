import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DimensionsCalculationError } from '../src/errors/dimensions-calculation-error.ts';

const fixturesDir = path.resolve('test/fixture/svg/special/without-dims');

async function loadCalculateSvgDimensions() {
  const module = await import('../src/utils/calculate-svg-dimensions.ts');
  return module.calculateSvgDimensions;
}

afterEach(() => {
  vi.doUnmock('@resvg/resvg-js');
  vi.resetModules();
});

describe('calculateSvgDimensions()', () => {
  it.each([
    { file: '46x46.svg', expected: { width: 46, height: 46 } },
    { file: '2048x2048.svg', expected: { width: 2048, height: 2048 } },
    { file: '32x32.svg', expected: { width: 32, height: 32 } },
    { file: '100x100.svg', expected: { width: 100, height: 100 } },
    { file: '231x69.svg', expected: { width: 231, height: 69 } }
  ])('returns expected dimensions for $file', async ({ file, expected }) => {
    const svg = await readFile(path.join(fixturesDir, file), 'utf8');
    const calculateSvgDimensions = await loadCalculateSvgDimensions();

    await expect(calculateSvgDimensions(svg)).resolves.toStrictEqual(expected);
  });

  it('returns stable results across repeated runs', async () => {
    const svg = await readFile(path.join(fixturesDir, '46x46.svg'), 'utf8');
    const calculateSvgDimensions = await loadCalculateSvgDimensions();

    const [firstRun, secondRun, thirdRun] = await Promise.all([
      calculateSvgDimensions(svg),
      calculateSvgDimensions(svg),
      calculateSvgDimensions(svg)
    ]);

    expect(firstRun).toStrictEqual(secondRun);
    expect(thirdRun).toStrictEqual(secondRun);
  });

  it('wraps renderer failures in DimensionsCalculationError', async () => {
    vi.doMock('@resvg/resvg-js', () => ({
      Resvg: class {
        readonly broken = true;

        constructor() {
          throw new Error('test');
        }
      }
    }));

    const calculateSvgDimensions = await loadCalculateSvgDimensions();

    await expect(calculateSvgDimensions('<svg/>')).rejects.toMatchObject({
      name: DimensionsCalculationError.name,
      message: 'test'
    });
  });
});
