import fs from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../../../src/index.ts';

const fixtureDir = path.resolve('tmp', 'ported-config-tests', 'meta');
const metaFile = path.join(fixtureDir, 'meta.yaml');
const metaLink = path.join(fixtureDir, 'meta-link.yaml');

describe('resolveConfig shape.meta', () => {
  beforeEach(async () => {
    await rm(fixtureDir, { force: true, recursive: true });
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(
      metaFile,
      [
        'nested/icon.svg:',
        '  title: Test title',
        '  description: Test description',
        'ignored: false'
      ].join('\n')
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(fixtureDir, { force: true, recursive: true });
  });

  it('defaults to empty meta when shape.meta is omitted', () => {
    expect(resolveConfig({ log: false }).shape.meta).toStrictEqual({});
    expect(resolveConfig({ shape: {}, log: false }).shape.meta).toStrictEqual({});
  });

  it('stats the configured file path', () => {
    const lstatSpy = vi.spyOn(fs, 'lstatSync');

    resolveConfig({ shape: { meta: metaFile }, log: false });

    expect(lstatSpy).toHaveBeenCalledWith(path.resolve(metaFile));
  });

  it('returns an empty object when the configured path is not a file', () => {
    const config = resolveConfig({ shape: { meta: fixtureDir }, log: false });

    expect(config.shape.meta).toStrictEqual({});
  });

  it('loads metadata from YAML files and ignores non-object entries', () => {
    const config = resolveConfig({ shape: { meta: metaFile }, log: false });

    expect(config.shape.meta).toStrictEqual({
      [path.join('nested', 'icon')]: {
        title: 'Test title',
        description: 'Test description'
      }
    });
  });

  it('follows symlinks before reading metadata', async () => {
    await symlink(metaFile, metaLink);
    const readlinkSpy = vi.spyOn(fs, 'readlinkSync');
    const statSpy = vi.spyOn(fs, 'statSync');

    const config = resolveConfig({ shape: { meta: metaLink }, log: false });

    expect(readlinkSpy).toHaveBeenCalledWith(path.resolve(metaLink));
    expect(statSpy).toHaveBeenCalledWith(metaFile);
    expect(config.shape.meta[path.join('nested', 'icon')]).toStrictEqual({
      title: 'Test title',
      description: 'Test description'
    });
  });
});
