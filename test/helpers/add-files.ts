import fs from 'node:fs';
import path from 'node:path';
import type { SvgSpriter } from '../../src/index.ts';

function addFixtureFilesBase(
  spriter: SvgSpriter,
  files: readonly string[],
  cwd: string,
  resolvePaths: boolean
): void {
  for (const file of files) {
    const filePath = path.join(cwd, file);

    spriter.add(
      resolvePaths ? path.resolve(filePath) : file,
      file,
      fs.readFileSync(filePath, 'utf8')
    );
  }
}

/** Add a bunch of SVG files (with absolute paths) */
export function addFixtureFiles(spriter: SvgSpriter, files: readonly string[], cwd: string): void {
  addFixtureFilesBase(spriter, files, cwd, true);
}

/** Add a bunch of SVG files with relative paths */
export function addRelativeFixtureFiles(
  spriter: SvgSpriter,
  files: readonly string[],
  cwd: string
): void {
  addFixtureFilesBase(spriter, files, cwd, false);
}
