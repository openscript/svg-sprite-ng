import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const paths: Record<'tmp' | 'fixtures' | 'expectations', string> = {
  tmp: path.resolve(dirname, '../../tmp'),
  fixtures: path.resolve(dirname, '../fixture'),
  expectations: path.resolve(dirname, '../expected')
};

export const browser: { width: number; height: number } = {
  width: 1280,
  height: 1024
};
