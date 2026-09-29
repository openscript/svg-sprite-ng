import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { PngComparison } from './compare-png-2-png.ts';
import { comparePng2Png } from './compare-png-2-png.ts';
import { convertSvg2Png } from './convert-svg-2-png.ts';

/** Rasterize an SVG file and compare it to an expected image. */
export async function compareSvg2Png(
  svg: string,
  png: string,
  expected: string
): Promise<PngComparison> {
  await mkdir(path.dirname(png), { recursive: true });
  await convertSvg2Png(svg, png);

  return comparePng2Png(png, expected);
}
