import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const paths: Record<'tmp' | 'fixtures' | 'expectations', string> = {
  tmp: process.env['SVG_SPRITE_TEST_TMP']
    ? path.resolve(process.env['SVG_SPRITE_TEST_TMP'])
    : path.resolve(dirname, '../../tmp'),
  fixtures: path.resolve(dirname, '../fixture'),
  expectations: path.resolve(dirname, '../expected')
};

export const browser: { width: number; height: number } = {
  width: 1280,
  height: 1024
};
