import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { SpriteFile } from '../../src/file.ts';
import { SvgSprite } from '../../src/sprite.ts';

describe('SvgSprite', () => {
  it('stores constructor settings and optional namespaces', () => {
    const transform = [vi.fn<(svg: string) => string>((svg: string) => svg)] as const;
    const withoutNamespaces = new SvgSprite(undefined, undefined, {}, false, transform);
    const withNamespaces = new SvgSprite(undefined, undefined, {}, true, []);

    expect(withoutNamespaces.transform).toBe(transform);
    expect(withoutNamespaces.content).toStrictEqual([]);
    expect(withoutNamespaces.xmlDeclaration).toBe('');
    expect(withoutNamespaces.doctypeDeclaration).toBe('');
    expect(withoutNamespaces.rootAttributes).not.toHaveProperty('xmlns');
    expect(withNamespaces.rootAttributes).toStrictEqual({
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink'
    });
  });

  it('adds string and array content and invalidates cached serialization', () => {
    const transform = vi.fn<(svg: string) => string>((svg: string) => svg);
    const sprite = new SvgSprite(undefined, undefined, {}, false, [transform]);

    sprite.add('<g />');
    expect(sprite.content).toStrictEqual(['<g />']);

    expect(sprite.toString()).toBe('<svg><g /></svg>');
    expect(transform).toHaveBeenCalledTimes(1);
    expect(sprite.toString()).toBe('<svg><g /></svg>');
    expect(transform).toHaveBeenCalledTimes(1);

    sprite.add(['<path />']);

    expect(sprite.content).toStrictEqual(['<g />', '<path />']);
    expect(sprite.toString()).toBe('<svg><g /><path /></svg>');
    expect(transform).toHaveBeenCalledTimes(2);
  });

  it('serializes root attributes and applies transforms in series', () => {
    const transform1 = vi.fn<(svg: string) => string>(() => '');
    const transform2 = vi.fn<(svg: string) => string>(() => 'TEST');
    const sprite = new SvgSprite('xml', 'doctype', { ATTR_1: 1, ATTR_2: 2 }, false, [
      transform1,
      transform2
    ]);

    expect(sprite.toString()).toBe('TEST');
    expect(transform1).toHaveBeenCalledWith('xmldoctype<svg ATTR_1="1" ATTR_2="2"></svg>');
    expect(transform2).toHaveBeenCalledWith('');
  });

  it('creates SpriteFile output from the serialized sprite', () => {
    const sprite = new SvgSprite(undefined, undefined, {}, false, []);
    const file = sprite.toFile('TEST_BASE', 'TEST_PATH');

    expect(file).toStrictEqual(
      new SpriteFile({
        base: 'TEST_BASE',
        path: 'TEST_PATH',
        contents: Buffer.from('<svg></svg>')
      })
    );
  });
});
