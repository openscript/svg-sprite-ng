import { rm } from 'node:fs/promises';
import { paths } from './constants.ts';

/** Remove the temporary test output directory */
export async function removeTempPath(pathName: string = paths.tmp): Promise<void> {
  await rm(pathName, { force: true, recursive: true });
}
