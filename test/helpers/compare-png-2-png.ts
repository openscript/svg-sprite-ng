import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const MAX_MISMATCH = 5;

export interface PngComparison {
  isEqual: boolean;
  matched: number;
  diff: PNG;
}

async function storeDiff(diff: PNG, filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, PNG.sync.write(diff));
}

export async function comparePng2Png(input: string, expected: string): Promise<PngComparison> {
  const inputPng = PNG.sync.read(await readFile(input));
  const expectedPng = PNG.sync.read(await readFile(expected));

  const { width, height } = inputPng;
  const diff = new PNG({ width, height });

  const matched = pixelmatch(inputPng.data, expectedPng.data, diff.data, width, height, {
    threshold: 0.1
  });

  if (matched <= MAX_MISMATCH) {
    return { isEqual: true, matched, diff };
  }

  await storeDiff(
    diff,
    path.join(path.dirname(input), path.basename(input).replace('.png', '.diff.png'))
  );

  return { isEqual: false, matched, diff };
}
