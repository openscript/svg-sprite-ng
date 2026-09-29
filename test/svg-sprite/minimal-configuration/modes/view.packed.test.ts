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

describe.each([
  ['default', constants.DEFAULT],
  ['w/o dims', constants.WITHOUT_DIMS]
] as const)('svg-sprite: %s in «view» mode', (_, testConfig) => {
  const tmpPath = path.join(paths.tmp, `view${testConfig.namespace}.packed`);

  let svg = '';
  let data: MustacheData;

  beforeAll(async () => {
    await removeTempPath(tmpPath);

    const spriter = new SvgSpriter({ dest: tmpPath, log: false });

    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    const { result, data: cssData } = await spriter.compile({
      view: {
        sprite: `svg/view.packed${testConfig.namespace}.svg`,
        layout: 'packed',
        dimensions: '-dims',
        render: {
          css: true
        }
      }
    });
    const viewData = cssData['view'];

    if (viewData === undefined) {
      throw new TypeError('Expected view Mustache data');
    }

    await writeFiles(result);
    data = viewData;
    svg = path.basename(getSpriteFile(getModeFiles(result, 'view')).path);
  });

  it('creates visually correct sprite with packed layout', async () => {
    expect.hasAssertions();

    const input = path.join(tmpPath, 'view/svg', svg);
    const actual = await readFile(input, 'utf8');
    const expected = path.join(paths.expectations, `png/css.packed${testConfig.namespace}.png`);

    expect(actual).toMatchSnapshot();
    await expect(input).toBeVisuallyEqualTo(expected);
  });

  it('creates a visually correct stylesheet resource in CSS format', async () => {
    expect.hasAssertions();

    const out = mustache.render(
      await readFile(path.join(import.meta.dirname, '../../../tmpl/view.html'), 'utf8'),
      {
        ...data,
        css: '../sprite.css'
      }
    );
    const preview = await writeFileWithDirs(path.join(tmpPath, 'view/html/view.html'), out);
    const expected = path.join(paths.expectations, `png/view.html${testConfig.namespace}.png`);

    expect(preview).not.toBeNull();
    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});
