import fs from 'node:fs';
import path from 'node:path';
import mustache from 'mustache';
import { compile } from 'sass';
import { beforeAll, describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';
import type { ModeFiles, MustacheData, SpriteResult } from '../../../src/index.ts';
import { SpriteFile, SvgSpriter } from '../../../src/index.ts';
import { renderLess } from '../../helpers/async-renderers.ts';
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
const tmpPath = path.join(paths.tmp, 'center');

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

describe(`svg-sprite: with centered alignment and ${align.length} SVG files`, () => {
  beforeAll(async () => {
    await removeTempPath(tmpPath);
  });

  describe('with «css» mode, vertical layout and CSS render type', () => {
    let data: MustacheData;
    let svgPath = '';

    beforeAll(async () => {
      const spriter = new SvgSpriter({
        dest: tmpPath,
        log: false,
        shape: {
          align: path.join(paths.fixtures, 'yaml/align.centered.yaml'),
          dimension: {
            maxWidth: 200,
            maxHeight: 200
          }
        }
      });

      addFixtureFiles(spriter, align, cwdAlign);
      const { result, data: cssData } = await spriter.compile({
        css: {
          sprite: 'svg/css.vertical.centered.svg',
          layout: 'vertical',
          dimensions: true,
          render: {
            css: {
              dest: 'sprite.centered.css'
            }
          }
        }
      });
      const cssDataValue = cssData['css'];

      if (cssDataValue === undefined) {
        throw new TypeError('Expected css Mustache data');
      }

      await writeFiles(result);
      data = cssDataValue;
      svgPath = path.basename(getSpriteFile(getModeFiles(result, 'css')).path);
    });

    it('creates visually correct sprite', async () => {
      expect.hasAssertions();

      const input = path.join(tmpPath, 'css/svg', svgPath);
      const actual = fs.readFileSync(input, 'utf8');
      const expected = path.join(paths.expectations, 'png/css.vertical.centered.png');

      expect(actual).toMatchSnapshot();
      await expect(input).toBeVisuallyEqualTo(expected);
    });

    it('creates a visually correct stylesheet resource', async () => {
      expect.hasAssertions();

      const out = mustache.render(previewTemplate, {
        ...data,
        css: '../sprite.centered.css'
      });
      const preview = await writeFileWithDirs(
        path.join(tmpPath, 'css/html/css.vertical.centered.html'),
        out
      );
      const expected = path.join(paths.expectations, 'png/css.vertical.centered.html.png');

      expect(preview).not.toBeNull();
      await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
    });
  });

  describe('with «css» mode, horizontal layout and Sass render type', () => {
    let data: MustacheData;
    let svgPath = '';

    beforeAll(async () => {
      const spriter = new SvgSpriter({
        dest: tmpPath,
        log: false,
        shape: {
          align: path.join(paths.fixtures, 'yaml/align.centered.yaml'),
          dimension: {
            maxWidth: 200,
            maxHeight: 200
          }
        }
      });

      addFixtureFiles(spriter, align, cwdAlign);
      const { result, data: cssData } = await spriter.compile({
        css: {
          sprite: 'svg/css.horizontal.centered.svg',
          layout: 'horizontal',
          dimensions: true,
          render: {
            scss: {
              dest: 'sprite.centered.scss'
            }
          }
        }
      });
      const cssDataValue = cssData['css'];

      if (cssDataValue === undefined) {
        throw new TypeError('Expected css Mustache data');
      }

      await writeFiles(result);
      data = cssDataValue;
      svgPath = path.basename(getSpriteFile(getModeFiles(result, 'css')).path);
    });

    it('creates visually correct sprite', async () => {
      expect.hasAssertions();

      const input = path.join(tmpPath, 'css/svg', svgPath);
      const actual = fs.readFileSync(input, 'utf8');
      const expected = path.join(paths.expectations, 'png/css.horizontal.centered.png');

      expect(actual).toMatchSnapshot();
      await expect(input).toBeVisuallyEqualTo(expected);
    });

    it('creates a visually correct stylesheet resource', async () => {
      expect.hasAssertions();

      const result = compile(path.join(tmpPath, 'css/sprite.centered.scss'));
      const cssPreview = await writeFileWithDirs(
        path.join(tmpPath, 'css/sprite.centered.scss.css'),
        result.css
      );
      const out = mustache.render(previewTemplate, {
        ...data,
        css: '../sprite.centered.scss.css'
      });
      const preview = await writeFileWithDirs(
        path.join(tmpPath, 'css/html/scss.horizontal.centered.html'),
        out
      );
      const expected = path.join(paths.expectations, 'png/css.horizontal.centered.html.png');

      expect(cssPreview).not.toBeNull();
      expect(preview).not.toBeNull();
      await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
    });
  });

  describe('with «css» mode, packed layout and LESS render type', () => {
    let data: MustacheData;
    let svgPath = '';

    beforeAll(async () => {
      const spriter = new SvgSpriter({
        dest: tmpPath,
        log: false,
        shape: {
          align: path.join(paths.fixtures, 'yaml/align.centered.yaml'),
          dimension: {
            maxWidth: 200,
            maxHeight: 200
          }
        }
      });

      addFixtureFiles(spriter, align, cwdAlign);
      const { result, data: cssData } = await spriter.compile({
        css: {
          sprite: 'svg/css.packed.centered.svg',
          layout: 'packed',
          dimensions: true,
          render: {
            less: {
              dest: 'sprite.centered.less'
            }
          }
        }
      });
      const cssDataValue = cssData['css'];

      if (cssDataValue === undefined) {
        throw new TypeError('Expected css Mustache data');
      }

      await writeFiles(result);
      data = cssDataValue;
      svgPath = path.basename(getSpriteFile(getModeFiles(result, 'css')).path);
    });

    it('creates visually correct sprite', async () => {
      expect.hasAssertions();

      const input = path.join(tmpPath, 'css/svg', svgPath);
      const actual = fs.readFileSync(input, 'utf8');
      const expected = path.join(paths.expectations, 'png/css.packed.centered.png');

      expect(actual).toMatchSnapshot();
      await expect(input).toBeVisuallyEqualTo(expected);
    });

    it('creates a visually correct stylesheet resource', async () => {
      expect.hasAssertions();

      const lessFile = path.join(tmpPath, 'css/sprite.centered.less');
      const lessText = fs.readFileSync(lessFile, 'utf8');
      const cssPreview = await writeFileWithDirs(
        path.join(tmpPath, 'css/sprite.centered.less.css'),
        await renderLess(lessText)
      );
      const out = mustache.render(previewTemplate, {
        ...data,
        css: '../sprite.centered.less.css'
      });
      const preview = await writeFileWithDirs(
        path.join(tmpPath, 'css/html/less.packed.centered.html'),
        out
      );
      const expected = path.join(paths.expectations, 'png/css.packed.aligned.html.png');

      expect(cssPreview).not.toBeNull();
      expect(preview).not.toBeNull();
      await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
    });
  });
});
