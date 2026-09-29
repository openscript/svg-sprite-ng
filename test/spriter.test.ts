import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SpriteFile, SvgSpriter } from '../src/index.ts';
import { SvgSpriterQueue } from '../src/queue.ts';
import type { ShapeTransformer } from '../src/types.ts';

const testSvg = path.resolve('test/fixture/svg/single/weather-clear.svg');
const testSvgContents = fs.readFileSync(testSvg, 'utf8');
const emptySvg = '<svg></svg>';

describe('SvgSpriter.add', () => {
  it('normalizes file-like input into a SpriteFile before queueing it', () => {
    const addSpy = vi.spyOn(SvgSpriterQueue.prototype, 'add').mockImplementation(() => undefined);
    const spriter = new SvgSpriter({ shape: { dest: 'svg' }, log: false });

    spriter.add({
      base: path.dirname('test/fixture/svg/single/weather-clear.svg'),
      path: testSvg,
      contents: Buffer.from(testSvgContents)
    });

    const queuedFile = addSpy.mock.calls[0]?.[0];
    expect(queuedFile).toBeInstanceOf(SpriteFile);
    expect(queuedFile?.base).toBe(path.resolve('test/fixture/svg/single'));
    expect(queuedFile?.path).toBe(testSvg);
    expect(queuedFile?.contents.toString()).toBe(testSvgContents);
  });

  it.each([
    [
      'absolute local name',
      () => new SvgSpriter({ log: false }).add(testSvg, path.resolve(testSvg), emptySvg)
    ],
    ['missing svg contents', () => new SvgSpriter({ log: false }).add(testSvg)],
    ['empty file path', () => new SvgSpriter({ log: false }).add('', undefined, emptySvg)],
    ['invalid local name', () => new SvgSpriter({ log: false }).add(' ', '../', emptySvg)],
    ['empty svg string', () => new SvgSpriter({ log: false }).add(testSvg, undefined, '')],
    [
      'mismatching local name',
      () => new SvgSpriter({ log: false }).add(testSvg, 'random.svg', emptySvg)
    ]
  ] as const)('throws for %s', (_label, run) => {
    expect(run).toThrow(Error);
  });

  it.each([undefined, '', 'weather-clear.svg'] as const)(
    'creates a SpriteFile from string input when name is %s',
    (name) => {
      const addSpy = vi.spyOn(SvgSpriterQueue.prototype, 'add').mockImplementation(() => undefined);
      const spriter = new SvgSpriter({ shape: { dest: 'svg' }, log: false });

      spriter.add(testSvg, name, emptySvg);

      const queuedFile = addSpy.mock.calls[0]?.[0];
      expect(queuedFile).toBeInstanceOf(SpriteFile);
      expect(queuedFile?.base).toBe(path.dirname(testSvg));
      expect(queuedFile?.path).toBe(testSvg);
      expect(queuedFile?.contents.toString()).toBe(emptySvg);
    }
  );
});

describe('SvgSpriter transforms', () => {
  it('runs custom shape transforms during compilation', async () => {
    const transform = vi.fn<ShapeTransformer>();
    const spriter = new SvgSpriter({
      shape: { dest: 'svg', transform: [transform] },
      log: false
    });

    spriter.add(testSvg, 'weather-clear.svg', testSvgContents);
    await spriter.compile({});

    expect(transform).toHaveBeenCalledTimes(1);
  });
});
