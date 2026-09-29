import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModeFiles, SpriteResult } from '../../../src/index.ts';
import { SvgSpriter } from '../../../src/index.ts';
import { paths } from '../../helpers/constants.ts';

const TEST_FONT_FACE =
  "@font-face{font-family:Montserrat-SemiBold;src:url() format('woff');font-weight:600;font-style:normal;font-display:swap}";

function getModeFiles(result: SpriteResult, mode: string): ModeFiles {
  const modeFiles = result[mode];

  if (modeFiles === undefined || Array.isArray(modeFiles)) {
    throw new TypeError(`Expected ${mode} mode files`);
  }

  return modeFiles;
}

describe('testing font face preserving', () => {
  it('preserve font-face in sprite', async () => {
    expect.hasAssertions();

    const spriter = new SvgSpriter({
      dest: '.',
      log: false,
      shape: {
        transform: []
      }
    });

    spriter.add(
      path.resolve(path.join(paths.fixtures, 'svg/special/font-face.svg')),
      'font-face.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45.06 13.7">
        <defs>
          <style>
            .cls-4{fill:#fff;border:1px}
            .d{fill:red}
            ${TEST_FONT_FACE}
          </style>
        </defs>
        <text font-family="Montserrat-SemiBold" font-weight="600">Google Play</text>
      </svg>`
    );

    const { result } = await spriter.compile({
      symbol: {
        sprite: 'svg/font-face.svg'
      }
    });
    const symbolFiles = getModeFiles(result, 'symbol');
    const sprite = symbolFiles.sprite;

    if (sprite === undefined) {
      throw new TypeError('Expected symbol sprite');
    }

    expect(sprite.contents.toString().trim()).toContain(TEST_FONT_FACE);
  });
});
