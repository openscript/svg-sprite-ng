import fs from 'node:fs';
import path from 'node:path';
import mustache from 'mustache';
import { compile } from 'sass';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ModeFiles, MustacheData, SpriteResult } from '../../../../src/index.ts';
import { SpriteFile, SvgSpriter } from '../../../../src/index.ts';
import { renderLess, renderStylus } from '../../../helpers/async-renderers.ts';
import { addFixtureFiles } from '../../../helpers/add-files.ts';
import { paths } from '../../../helpers/constants.ts';
import { removeTempPath } from '../../../helpers/remove-temp-path.ts';
import { constants } from '../../../helpers/test-configs.ts';
import { writeFileWithDirs } from '../../../helpers/write-file.ts';
import { writeFiles } from '../../../helpers/write-files.ts';

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

describe.each([
  ['default', constants.DEFAULT],
  ['w/o dims', constants.WITHOUT_DIMS]
] as const)('testing minimal config', (name, testConfig) => {
  describe(`${name}: with minimum configuration`, () => {
    const tmpPath = path.join(paths.tmp, `css${testConfig.namespace}`);
    const svg = {
      vertical: '',
      horizontal: '',
      diagonal: '',
      packed: ''
    };
    let spriter: SvgSpriter;
    let data: MustacheData;

    beforeAll(async () => {
      await removeTempPath(tmpPath);

      spriter = new SvgSpriter({ dest: tmpPath, log: false });
      addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
      const { result, data: cssData } = await spriter.compile({
        css: {
          sprite: `svg/css.vertical${testConfig.namespace}.svg`,
          layout: 'vertical',
          dimensions: true,
          render: {
            css: {
              dest: `sprite${testConfig.namespace}.css`
            },
            scss: {
              dest: `sprite${testConfig.namespace}.scss`
            },
            less: {
              dest: `sprite${testConfig.namespace}.less`
            },
            styl: {
              dest: `sprite${testConfig.namespace}.styl`
            }
          }
        }
      });
      const cssModeFiles = getModeFiles(result, 'css');
      const cssDataValue = cssData['css'];

      if (cssDataValue === undefined) {
        throw new TypeError('Expected css Mustache data');
      }

      await writeFiles(result);
      data = cssDataValue;
      svg.vertical = path.basename(getSpriteFile(cssModeFiles).path);

      await Promise.all(
        (['horizontal', 'diagonal', 'packed'] as const).map(async (layout) => {
          const { result: layoutResult } = await spriter.compile({
            css: {
              sprite: `svg/css.${layout}${testConfig.namespace}.svg`,
              layout
            }
          });
          const layoutModeFiles = getModeFiles(layoutResult, 'css');

          await writeFiles(layoutResult);
          svg[layout] = path.basename(getSpriteFile(layoutModeFiles).path);
        })
      );
    });

    describe('creates visually correct sprite with', () => {
      it('vertical layout', async () => {
        expect.hasAssertions();

        const input = path.join(tmpPath, 'css/svg', svg.vertical);
        const actual = fs.readFileSync(input, 'utf8');
        const expected = path.join(
          paths.expectations,
          `png/css.vertical${testConfig.namespace}.png`
        );

        expect(actual).toMatchSnapshot();
        await expect(input).toBeVisuallyEqualTo(expected);
      });

      it('horizontal layout', async () => {
        expect.hasAssertions();

        const input = path.join(tmpPath, 'css/svg', svg.horizontal);
        const actual = fs.readFileSync(input, 'utf8');
        const expected = path.join(
          paths.expectations,
          `png/css.horizontal${testConfig.namespace}.png`
        );

        expect(actual).toMatchSnapshot();
        await expect(input).toBeVisuallyEqualTo(expected);
      });

      it('diagonal layout', async () => {
        expect.hasAssertions();

        const input = path.join(tmpPath, 'css/svg', svg.diagonal);
        const actual = fs.readFileSync(input, 'utf8');
        const expected = path.join(
          paths.expectations,
          `png/css.diagonal${testConfig.namespace}.png`
        );

        expect(actual).toMatchSnapshot();
        await expect(input).toBeVisuallyEqualTo(expected);
      });

      it('packed layout', async () => {
        expect.hasAssertions();

        const input = path.join(tmpPath, 'css/svg', svg.packed);
        const actual = fs.readFileSync(input, 'utf8');
        const expected = path.join(paths.expectations, `png/css.packed${testConfig.namespace}.png`);

        expect(actual).toMatchSnapshot();
        await expect(input).toBeVisuallyEqualTo(expected);
      });
    });

    describe('creates a visually correct stylesheet resource in', () => {
      it('CSS format', async () => {
        expect.hasAssertions();

        const out = mustache.render(previewTemplate, {
          ...data,
          css: `../sprite${testConfig.namespace}.css`
        });
        const preview = await writeFileWithDirs(
          path.join(tmpPath, `css/html/css${testConfig.namespace}.html`),
          out
        );
        const expected = path.join(paths.expectations, `png/css.html${testConfig.namespace}.png`);

        expect(preview).not.toBeNull();
        await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
      });

      it('Sass format', async () => {
        expect.hasAssertions();

        const result = compile(path.join(tmpPath, `css/sprite${testConfig.namespace}.scss`));
        const cssFile = path.join(tmpPath, `css/sprite${testConfig.namespace}.scss.css`);
        const preview = await writeFileWithDirs(cssFile, result.css);
        const out = mustache.render(previewTemplate, {
          ...data,
          css: `../sprite${testConfig.namespace}.scss.css`
        });
        const htmlPreview = await writeFileWithDirs(
          path.join(tmpPath, `css/html/scss${testConfig.namespace}.html`),
          out
        );
        const expected = path.join(paths.expectations, `png/css.html${testConfig.namespace}.png`);

        expect(preview).not.toBeNull();
        expect(htmlPreview).not.toBeNull();
        await expect(htmlPreview).toBeVisuallyCorrectAsHTMLTo(expected);
      });

      it('LESS format', async () => {
        expect.hasAssertions();

        const lessFile = path.join(tmpPath, `css/sprite${testConfig.namespace}.less`);
        const lessText = fs.readFileSync(lessFile, 'utf8');
        const cssFile = path.join(tmpPath, `css/sprite${testConfig.namespace}.less.css`);
        const preview = await writeFileWithDirs(cssFile, await renderLess(lessText));
        const out = mustache.render(previewTemplate, {
          ...data,
          css: `../sprite${testConfig.namespace}.less.css`
        });
        const htmlPreview = await writeFileWithDirs(
          path.join(tmpPath, `css/html/less${testConfig.namespace}.html`),
          out
        );
        const expected = path.join(paths.expectations, `png/css.html${testConfig.namespace}.png`);

        expect(preview).not.toBeNull();
        expect(htmlPreview).not.toBeNull();
        await expect(htmlPreview).toBeVisuallyCorrectAsHTMLTo(expected);
      });

      it('Stylus format', async () => {
        expect.hasAssertions();

        const stylusFile = path.join(tmpPath, `css/sprite${testConfig.namespace}.styl`);
        const stylusText = fs.readFileSync(stylusFile, 'utf8');
        const cssFile = path.join(tmpPath, `css/sprite${testConfig.namespace}.styl.css`);
        const preview = await writeFileWithDirs(cssFile, await renderStylus(stylusText));
        const out = mustache.render(previewTemplate, {
          ...data,
          css: `../sprite${testConfig.namespace}.styl.css`
        });
        const htmlPreview = await writeFileWithDirs(
          path.join(tmpPath, `css/html/styl${testConfig.namespace}.html`),
          out
        );
        const expected = path.join(paths.expectations, `png/css.html${testConfig.namespace}.png`);

        expect(preview).not.toBeNull();
        expect(htmlPreview).not.toBeNull();
        await expect(htmlPreview).toBeVisuallyCorrectAsHTMLTo(expected);
      });
    });
  });
});
