import fs from 'node:fs';
import path from 'node:path';
import mustache from 'mustache';
import { beforeAll, describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';
import type { ModeFiles, MustacheData, SpriteResult } from '../../../../src/index.ts';
import { SpriteFile, SvgSpriter } from '../../../../src/index.ts';
import { renderLess } from '../../../helpers/async-renderers.ts';
import { addFixtureFiles } from '../../../helpers/add-files.ts';
import { paths } from '../../../helpers/constants.ts';
import { removeTempPath } from '../../../helpers/remove-temp-path.ts';
import { writeFileWithDirs } from '../../../helpers/write-file.ts';
import { writeFiles } from '../../../helpers/write-files.ts';

const tmpPath = path.join(paths.tmp, 'view.mixed');
const cwdAlign = path.join(paths.fixtures, 'svg/css');
const align = globSync('**/*.svg', { cwd: cwdAlign }).toSorted();
const previewTemplate = fs.readFileSync(
  path.join(import.meta.dirname, '../../../tmpl/css.html'),
  'utf8'
);

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

describe('svg-sprite: with «view» mode, packed layout and LESS render type', () => {
  let packedSvg = '';
  let data: MustacheData;

  beforeAll(async () => {
    await removeTempPath(tmpPath);

    const spriter = new SvgSpriter({
      dest: tmpPath,
      log: false,
      shape: {
        align: path.join(paths.fixtures, 'yaml/align.mixed.yaml'),
        dimension: {
          maxWidth: 200,
          maxHeight: 200
        }
      }
    });

    addFixtureFiles(spriter, align, cwdAlign);
    const { result, data: cssData } = await spriter.compile({
      view: {
        sprite: 'svg/view.packed.mixed.svg',
        layout: 'packed',
        dimensions: true,
        render: {
          less: {
            dest: 'sprite.mixed.less'
          }
        }
      }
    });
    const viewData = cssData['view'];

    if (viewData === undefined) {
      throw new TypeError('Expected view Mustache data');
    }

    await writeFiles(result);
    data = viewData;
    packedSvg = path.basename(getSpriteFile(getModeFiles(result, 'view')).path);
  });

  it('creates visually correct sprite', async () => {
    expect.hasAssertions();

    const input = path.join(tmpPath, 'view/svg', packedSvg);
    const actual = fs.readFileSync(input, 'utf8');
    const expected = path.join(paths.expectations, 'png/css.packed.mixed.png');

    expect(actual).toMatchSnapshot();
    await expect(input).toBeVisuallyEqualTo(expected);
  });

  it('creates a visually correct stylesheet resource', async () => {
    expect.hasAssertions();

    const lessFile = path.join(tmpPath, 'view/sprite.mixed.less');
    const lessText = fs.readFileSync(lessFile, 'utf8');
    const cssPreview = await writeFileWithDirs(
      path.join(tmpPath, 'view/sprite.mixed.less.css'),
      await renderLess(lessText)
    );
    const out = mustache.render(previewTemplate, {
      ...data,
      css: '../sprite.mixed.less.css'
    });
    const preview = await writeFileWithDirs(
      path.join(tmpPath, 'view/html/less.packed.mixed.html'),
      out
    );
    const expected = path.join(paths.expectations, 'png/css.packed.aligned.html.png');

    expect(cssPreview).not.toBeNull();
    expect(preview).not.toBeNull();
    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});
