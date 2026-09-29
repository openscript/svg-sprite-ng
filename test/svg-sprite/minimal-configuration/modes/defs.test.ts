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
] as const)('svg-sprite: %s: «defs» mode', (_, testConfig) => {
  const tmpPath = path.join(paths.tmp, `defs${testConfig.namespace}`);

  let svg = '';
  let data: MustacheData;

  beforeAll(async () => {
    await removeTempPath(tmpPath);

    const spriter = new SvgSpriter({ dest: tmpPath, log: false });

    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    const { result, data: cssData } = await spriter.compile({
      defs: {
        sprite: `svg/defs${testConfig.namespace}.svg`,
        render: {
          css: true
        }
      }
    });
    const defsData = cssData['defs'];

    if (defsData === undefined) {
      throw new TypeError('Expected defs Mustache data');
    }

    await writeFiles(result);
    data = defsData;
    svg = path.basename(getSpriteFile(getModeFiles(result, 'defs')).path);
  });

  it('creates a visually correct stylesheet resource in CSS format', async () => {
    expect.hasAssertions();

    const svgMarkup = await readFile(path.join(tmpPath, 'defs/svg', svg), 'utf8');
    const out = mustache.render(
      await readFile(path.join(import.meta.dirname, '../../../tmpl/defs.html'), 'utf8'),
      {
        ...data,
        svg: svgMarkup,
        css: '../sprite.css'
      }
    );
    const preview = await writeFileWithDirs(
      path.join(tmpPath, `defs/html/defs${testConfig.namespace}.html`),
      out
    );
    const expected = path.join(paths.expectations, `png/defs${testConfig.namespace}.html.png`);

    expect(svgMarkup).toMatchSnapshot();
    expect(preview).not.toBeNull();
    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});
