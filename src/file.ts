import { Buffer } from 'node:buffer';
import path from 'node:path';

/** Minimal file shape accepted by `SvgSpriter#add()`. Vinyl file instances satisfy it. */
export interface SpriteFileLike {
  path: string;
  base: string;
  contents: Buffer | Uint8Array | string | null;
}

function removeTrailingSep(value: string): string {
  let result = value;

  while (
    result.length > 1 &&
    (result.endsWith('/') || result.endsWith(path.sep)) &&
    path.parse(result).root !== result
  ) {
    result = result.slice(0, -1);
  }

  return result;
}

/** A file produced by the spriter (or handed to it). Compatible with the parts of Vinyl that svg-sprite uses. */
export class SpriteFile {
  readonly path: string;
  base: string;
  readonly contents: Buffer;

  constructor({ path: filePath, base, contents }: SpriteFileLike) {
    this.path = path.normalize(filePath);
    this.base = removeTrailingSep(path.normalize(base));
    this.contents =
      typeof contents === 'string' ? Buffer.from(contents) : Buffer.from(contents ?? '');
  }

  /** Path relative to `base` */
  get relative(): string {
    return path.relative(this.base, this.path);
  }
}
