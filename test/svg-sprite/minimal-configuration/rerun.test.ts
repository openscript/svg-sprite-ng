import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';
import type { ModeFiles, SpriteResult } from '../../../src/index.ts';
import { SvgSpriter } from '../../../src/index.ts';
import { addFixtureFiles } from '../../helpers/add-files.ts';
import { paths } from '../../helpers/constants.ts';
import { removeTempPath } from '../../helpers/remove-temp-path.ts';

const cwd = path.join(paths.fixtures, 'svg/single');
const weather = globSync('**/weather*.svg', { cwd }).toSorted();
const tmpPath = path.join(paths.tmp, 'rerun');

function getModeFiles(result: SpriteResult, mode: string): ModeFiles {
  const modeFiles = result[mode];

  if (modeFiles === undefined || Array.isArray(modeFiles)) {
    throw new TypeError(`Expected ${mode} mode files`);
  }

  return modeFiles;
}

describe('testing rerun', () => {
  it('creates 5 files and then additional 1 on each layout after rerun when all render types disabled', async () => {
    expect.assertions(8);

    await removeTempPath(tmpPath);

    const spriter = new SvgSpriter({ dest: tmpPath, log: false });

    addFixtureFiles(spriter, weather, cwd);

    const { result: firstResult } = await spriter.compile({
      css: {
        sprite: 'svg/css.vertical.svg',
        layout: 'vertical',
        dimensions: true,
        render: {
          css: true,
          scss: true,
          less: true,
          styl: true
        }
      }
    });
    const firstModeFiles = getModeFiles(firstResult, 'css');

    expect(firstModeFiles).toBeInstanceOf(Object);
    expect(Object.values(firstModeFiles)).toHaveLength(5);

    const otherLayouts = ['horizontal', 'diagonal', 'packed'] as const;

    await Promise.all(
      otherLayouts.map(async (layout) => {
        const { result } = await spriter.compile({
          css: {
            sprite: `svg/css.${layout}.svg`,
            layout
          }
        });
        const modeFiles = getModeFiles(result, 'css');

        expect(modeFiles).toBeInstanceOf(Object);
        expect(Object.values(modeFiles)).toHaveLength(1);
      })
    );
  });
});
