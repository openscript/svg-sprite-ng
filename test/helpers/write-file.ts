import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Prepare and output a file and create directories as necessary
 *
 * @returns The file path, or `null` if writing failed
 */
export async function writeFileWithDirs(
  file: string,
  content: string | Uint8Array
): Promise<string | null> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);

    return file;
  } catch {
    return null;
  }
}
