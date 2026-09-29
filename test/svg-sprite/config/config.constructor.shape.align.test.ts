import fs from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../../../src/index.ts';

const defaultAlign = { '*': { '%s': 0 } };
const fixtureDir = path.resolve('tmp', 'ported-config-tests', 'align');
const alignFile = path.join(fixtureDir, 'align.yaml');
const alignLink = path.join(fixtureDir, 'align-link.yaml');

describe('resolveConfig shape.align', () => {
  beforeEach(async () => {
    await rm(fixtureDir, { force: true, recursive: true });
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(
      alignFile,
      ['nested/icon.svg:', '  plain: 2', '  "%s-ready": -1', '  "": 1', 'ignored: true'].join('\n')
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(fixtureDir, { force: true, recursive: true });
  });

  it('defaults to the wildcard alignment when shape.align is omitted or non-string', () => {
    expect(resolveConfig({ log: false }).shape.align).toStrictEqual(defaultAlign);
  });

  it('stats the configured file path', () => {
    const lstatSpy = vi.spyOn(fs, 'lstatSync');

    resolveConfig({ shape: { align: alignFile }, log: false });

    expect(lstatSpy).toHaveBeenCalledWith(path.resolve(alignFile));
  });

  it('returns the default alignment when the configured path is not a file', () => {
    const config = resolveConfig({ shape: { align: fixtureDir }, log: false });

    expect(config.shape.align).toStrictEqual(defaultAlign);
  });

  it('loads alignment data from YAML files and normalizes templates and values', () => {
    const config = resolveConfig({ shape: { align: alignFile }, log: false });

    expect(config.shape.align).toStrictEqual({
      ...defaultAlign,
      [path.join('nested', 'icon')]: {
        '%splain': 1,
        '%s-ready': 0,
        '%s': 1
      }
    });
  });

  it('follows symlinks before reading alignment data', async () => {
    await symlink(alignFile, alignLink);
    const readlinkSpy = vi.spyOn(fs, 'readlinkSync');
    const statSpy = vi.spyOn(fs, 'statSync');

    const config = resolveConfig({ shape: { align: alignLink }, log: false });

    expect(readlinkSpy).toHaveBeenCalledWith(path.resolve(alignLink));
    expect(statSpy).toHaveBeenCalledWith(alignFile);
    expect(config.shape.align[path.join('nested', 'icon')]).toStrictEqual({
      '%splain': 1,
      '%s-ready': 0,
      '%s': 1
    });
  });
});
