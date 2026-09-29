import { describe, expect, it } from 'vitest';
import type { SvgShape } from '../../../src/shape.ts';
import { SvgSpriteCssPacker } from '../../../src/mode/css/packer.ts';

interface FakeShape {
  master: SvgShape | null;
  getDimensions: () => { width: number; height: number };
}

function createShape(width: number, height: number, master = false): FakeShape {
  return {
    master: master ? ({} as SvgShape) : null,
    getDimensions: () => ({ width, height })
  };
}

function overlaps(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

describe('SvgSpriteCssPacker', () => {
  it('initializes positions for every shape and sorts non-master blocks by size', () => {
    const shapes = [
      createShape(5, 0),
      createShape(0, 5),
      createShape(0, 6),
      createShape(6, 0),
      createShape(1, 1, true)
    ] as unknown as readonly SvgShape[];

    const packer = new SvgSpriteCssPacker(shapes);

    expect(packer.shapes).toBe(shapes);
    expect(packer.positions).toStrictEqual(shapes.map(() => ({ x: 0, y: 0 })));
    expect(packer.blocks).toStrictEqual([
      { index: 2, width: 0, height: 6 },
      { index: 3, width: 6, height: 0 },
      { index: 0, width: 5, height: 0 },
      { index: 1, width: 0, height: 5 }
    ]);
    expect(packer.root).toStrictEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('returns an empty layout when no packable blocks exist', () => {
    const packer = new SvgSpriteCssPacker([]);

    expect(packer.fit()).toStrictEqual([]);
    expect(packer.root).toStrictEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('packs shapes into non-overlapping positions while leaving master copies at the origin', () => {
    const dimensions = [
      { width: 60, height: 20 },
      { width: 20, height: 60 },
      { width: 30, height: 30 },
      { width: 10, height: 10 }
    ] as const;
    const shapes = [
      createShape(dimensions[0].width, dimensions[0].height),
      createShape(dimensions[1].width, dimensions[1].height),
      createShape(dimensions[2].width, dimensions[2].height),
      createShape(dimensions[3].width, dimensions[3].height, true)
    ] as unknown as readonly SvgShape[];

    const packer = new SvgSpriteCssPacker(shapes);
    const positions = packer.fit();
    const placed = dimensions
      .slice(0, 3)
      .map((dimension, index) => ({ ...positions[index]!, ...dimension }));

    expect(positions).toHaveLength(4);
    expect(positions[3]).toStrictEqual({ x: 0, y: 0 });
    expect(packer.root.width).toBeGreaterThanOrEqual(
      Math.max(...placed.map((rectangle) => rectangle.x + rectangle.width))
    );
    expect(packer.root.height).toBeGreaterThanOrEqual(
      Math.max(...placed.map((rectangle) => rectangle.y + rectangle.height))
    );

    for (let firstIndex = 0; firstIndex < placed.length; firstIndex++) {
      const first = placed[firstIndex]!;
      expect(first.x).toBeGreaterThanOrEqual(0);
      expect(first.y).toBeGreaterThanOrEqual(0);

      for (let secondIndex = firstIndex + 1; secondIndex < placed.length; secondIndex++) {
        expect(overlaps(first, placed[secondIndex]!)).toBe(false);
      }
    }
  });
});
