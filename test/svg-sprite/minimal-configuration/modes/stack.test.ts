import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mustache from 'mustache';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ModeFiles, MustacheData, SpriteResult } from '../../../../src/index.ts';
import { SpriteFile, SvgSpriter } from '../../../../src/index.ts';
import { addFixtureFiles } from '../../../helpers/add-files.ts';
import { paths } from '../../../helpers/constants.ts';
import { removeTempPath } from '../../../helpers/remove-temp-path.ts';
import { constants } from '../../../helpers/test-configs.ts';
import { writeFileWithDirs } from '../../../helpers/write-file.ts';
import { writeFiles } from '../../../helpers/write-files.ts';

function getModeFiles(result: SpriteResult, mode: string): ModeFiles {
  const modeFiles = result[mode];

  if (modeFiles === undefined || Array.isArray(modeFiles)) {
    throw new TypeError(`Expected ${mode} mode files`);
  }

  return modeFiles;
}

function getSpriteFile(modeFiles: ModeFiles): SpriteFile {
  if (!(modeFiles.sprite instanceof SpriteFile)) {
    throw new TypeError('Expected sprite file');
  }

  return modeFiles.sprite;
}

async function buildStackPreview(
  tmpPath: string,
  fileName: string,
  data: MustacheData,
  svg: string
): Promise<string | null> {
  const out = mustache.render(
    await readFile(path.join(import.meta.dirname, '../../../tmpl/stack.html'), 'utf8'),
    {
      ...data,
      svg,
      css: '../sprite.css'
    }
  );

  return writeFileWithDirs(fileName, out);
}

describe.each([
  ['default', constants.DEFAULT],
  ['w/o dims', constants.WITHOUT_DIMS]
] as const)('svg-sprite: %s: «stack» mode', (_, testConfig) => {
  const tmpPath = path.join(paths.tmp, `stack${testConfig.namespace}`);

  let svg = '';
  let data: MustacheData;

  beforeAll(async () => {
    await removeTempPath(tmpPath);

    const spriter = new SvgSpriter({ dest: tmpPath, log: false });

    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    const { result, data: cssData } = await spriter.compile({
      stack: {
        sprite: `svg/stack${testConfig.namespace}.svg`,
        render: {
          css: true
        }
      }
    });
    const stackData = cssData['stack'];

    if (stackData === undefined) {
      throw new TypeError('Expected stack Mustache data');
    }

    await writeFiles(result);
    data = stackData;
    svg = path.basename(getSpriteFile(getModeFiles(result, 'stack')).path);
  });

  it('creates a visually correct stylesheet resource in CSS format', async () => {
    expect.hasAssertions();

    const svgMarkup = await readFile(path.join(tmpPath, 'stack/svg', svg), 'utf8');
    const preview = await buildStackPreview(
      tmpPath,
      path.join(tmpPath, `stack/html/stack${testConfig.namespace}.html`),
      data,
      svgMarkup
    );
    const expected = path.join(paths.expectations, `png/stack${testConfig.namespace}.html.png`);

    expect(svgMarkup).toMatchSnapshot();
    expect(preview).not.toBeNull();
    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});

describe('without viewbox', () => {
  const testConfig = constants.WITHOUT_DIMS;
  const tmpPath = path.join(paths.tmp, 'stack-without-viewbox');

  let svg = '';
  let data: MustacheData;

  beforeAll(async () => {
    await removeTempPath(tmpPath);

    const spriter = new SvgSpriter({ dest: tmpPath, log: false });

    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    const { result, data: cssData } = await spriter.compile({
      stack: {
        sprite: `svg/stack${testConfig.namespace}.svg`,
        render: {
          css: true
        },
        rootviewbox: false
      }
    });
    const stackData = cssData['stack'];

    if (stackData === undefined) {
      throw new TypeError('Expected stack Mustache data');
    }

    await writeFiles(result);
    data = stackData;
    svg = path.basename(getSpriteFile(getModeFiles(result, 'stack')).path);
  });

  it('creates a visually correct stylesheet resource in CSS format', async () => {
    expect.hasAssertions();

    const svgMarkup = await readFile(path.join(tmpPath, 'stack/svg', svg), 'utf8');
    const preview = await buildStackPreview(
      tmpPath,
      path.join(tmpPath, 'stack/html/stack-without-viewbox.html'),
      data,
      svgMarkup
    );
    const expected = path.join(paths.expectations, 'png/stack-without-viewbox.html.png');

    expect(svgMarkup).toMatchSnapshot();
    expect(preview).not.toBeNull();
    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});
