import fs from 'node:fs';
import path from 'node:path';
import mustache from 'mustache';
import { compile } from 'sass';
import { beforeAll, describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';
import type { ModeFiles, MustacheData, SpriteResult } from '../../../src/index.ts';
import { SpriteFile, SvgSpriter } from '../../../src/index.ts';
import { addFixtureFiles } from '../../helpers/add-files.ts';
import { paths } from '../../helpers/constants.ts';
import { removeTempPath } from '../../helpers/remove-temp-path.ts';
import { writeFileWithDirs } from '../../helpers/write-file.ts';
import { writeFiles } from '../../helpers/write-files.ts';

const cwdAlign = path.join(paths.fixtures, 'svg/css');
const align = globSync('**/*.svg', { cwd: cwdAlign }).toSorted();
const previewTemplate = fs.readFileSync(
  path.join(import.meta.dirname, '../../tmpl/css.html'),
  'utf8'
);
const tmpPath = path.join(paths.tmp, 'mixed');

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

describe(`svg-sprite: with mixed alignment and ${align.length} SVG files`, () => {
  beforeAll(async () => {
    await removeTempPath(tmpPath);
  });

  describe('with «view» mode, vertical layout and CSS render type', () => {
    let data: MustacheData;
    let svgPath = '';

    beforeAll(async () => {
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
          sprite: 'svg/view.vertical.mixed.svg',
          layout: 'vertical',
          dimensions: true,
          render: {
            css: {
              dest: 'sprite.mixed.css'
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
      svgPath = path.basename(getSpriteFile(getModeFiles(result, 'view')).path);
    });

    it('creates visually correct sprite', async () => {
      expect.hasAssertions();

      const input = path.join(tmpPath, 'view/svg', svgPath);
      const actual = fs.readFileSync(input, 'utf8');
      const expected = path.join(paths.expectations, 'png/css.vertical.mixed.png');

      expect(actual).toMatchSnapshot();
      await expect(input).toBeVisuallyEqualTo(expected);
    });

    it('creates a visually correct stylesheet resource', async () => {
      expect.hasAssertions();

      const out = mustache.render(previewTemplate, {
        ...data,
        css: '../sprite.mixed.css'
      });
      const preview = await writeFileWithDirs(
        path.join(tmpPath, 'view/html/css.vertical.mixed.html'),
        out
      );
      const expected = path.join(paths.expectations, 'png/css.vertical.mixed.html.png');

      expect(preview).not.toBeNull();
      await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
    });
  });

  describe('with «view» mode, horizontal layout and Sass render type', () => {
    let data: MustacheData;
    let svgPath = '';

    beforeAll(async () => {
      const spriter = new SvgSpriter({
        dest: tmpPath,
        log: false,
        shape: {
          align: path.join(paths.fixtures, 'yaml/align.mixed.yaml'),
          dimension: {
            maxWidth: 200,
            maxHeight: 200
          },
          dest: 'shapes'
        },
        svg: {
          namespaceIDs: true
        }
      });

      addFixtureFiles(spriter, align, cwdAlign);
      const { result, data: cssData } = await spriter.compile({
        view: {
          sprite: 'svg/view.horizontal.mixed.svg',
          layout: 'horizontal',
          dimensions: true,
          render: {
            scss: {
              dest: 'sprite.mixed.scss'
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
      svgPath = path.basename(getSpriteFile(getModeFiles(result, 'view')).path);
    });

    it('creates visually correct sprite', async () => {
      expect.hasAssertions();

      const input = path.join(tmpPath, 'view/svg', svgPath);
      const actual = fs.readFileSync(input, 'utf8');
      const expected = path.join(paths.expectations, 'png/css.horizontal.mixed.png');

      expect(actual).toMatchSnapshot();
      await expect(input).toBeVisuallyEqualTo(expected);
    });

    it('creates a visually correct stylesheet resource', async () => {
      expect.hasAssertions();

      const result = compile(path.join(tmpPath, 'view/sprite.mixed.scss'));
      const cssPreview = await writeFileWithDirs(
        path.join(tmpPath, 'view/sprite.mixed.scss.css'),
        result.css
      );
      const out = mustache.render(previewTemplate, {
        ...data,
        css: '../sprite.mixed.scss.css'
      });
      const preview = await writeFileWithDirs(
        path.join(tmpPath, 'view/html/scss.horizontal.mixed.html'),
        out
      );
      const expected = path.join(paths.expectations, 'png/css.horizontal.mixed.html.png');

      expect(cssPreview).not.toBeNull();
      expect(preview).not.toBeNull();
      await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
    });
  });
});
