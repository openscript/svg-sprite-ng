import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SpriteFile } from '../file.ts';
import type { SpriteResult } from '../types.ts';

type FileTree = SpriteResult | SpriteResult[string];

/**
 * Recursively write the compiled files to disc.
 *
 * @returns  Number of written files
 */
export async function writeFiles(files: FileTree): Promise<number> {
  let written = 0;

  if (files === undefined) {
    return written;
  }

  for (const file of Object.values(files)) {
    if (file instanceof SpriteFile) {
      await mkdir(path.dirname(file.path), { recursive: true });
      await writeFile(file.path, file.contents);
      written++;
    } else if (typeof file === 'object' && file !== null) {
      written += await writeFiles(file);
    }
  }

  return written;
}
