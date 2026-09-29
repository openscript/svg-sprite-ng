import type { SvgShape } from '../../shape.ts';

interface Block {
  index: number;
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

interface Node {
  x: number;
  y: number;
  width: number;
  height: number;
  used?: boolean;
  down?: Node;
  right?: Node;
}

/** Bin packer for CSS sprites. */
export class SvgSpriteCssPacker {
  readonly shapes: readonly SvgShape[];
  readonly blocks: Block[] = [];
  readonly positions: Position[] = [];
  root: Node = { x: 0, y: 0, width: 0, height: 0 };

  constructor(shapes: readonly SvgShape[]) {
    this.shapes = shapes;

    for (const [index, shape] of shapes.entries()) {
      if (!shape.master) {
        const { width, height } = shape.getDimensions();
        this.blocks.push({ index, width, height });
      }

      this.positions.push({ x: 0, y: 0 });
    }

    this.blocks.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
  }

  /** Fit and return the shape positions */
  fit(): Position[] {
    const [first] = this.blocks;

    if (!first) {
      return [];
    }

    this.root.width = first.width;
    this.root.height = first.height;

    for (const { index, width, height } of this.blocks) {
      const node = this.#findNode(this.root, width, height);
      const { x, y } = node
        ? this.#splitNode(node, width, height)
        : this.#growNode(width, height) || { x: 0, y: 0 };
      this.positions[index] = { x, y };
    }

    return this.positions;
  }

  #findNode(root: Node, width: number, height: number): Node | null {
    if (root.used) {
      return (
        (root.right ? this.#findNode(root.right, width, height) : null) ??
        (root.down ? this.#findNode(root.down, width, height) : null)
      );
    }

    return width <= root.width && height <= root.height ? root : null;
  }

  #splitNode(node: Node, width: number, height: number): Node {
    node.used = true;
    node.down = { x: node.x, y: node.y + height, width: node.width, height: node.height - height };
    node.right = { x: node.x + width, y: node.y, width: node.width - width, height };

    return node;
  }

  #growNode(width: number, height: number): Node | false | null {
    const canGrowBottom = width <= this.root.width;
    const canGrowRight = height <= this.root.height;
    const shouldGrowRight = canGrowRight && this.root.height >= this.root.width + width;
    const shouldGrowBottom = canGrowBottom && this.root.width >= this.root.height + height;

    if (shouldGrowRight) {
      return this.#growRight(width, height);
    }

    if (shouldGrowBottom) {
      return this.#growBottom(width, height);
    }

    if (canGrowRight) {
      return this.#growRight(width, height);
    }

    if (canGrowBottom) {
      return this.#growBottom(width, height);
    }

    return null;
  }

  #growRight(width: number, height: number): Node | false {
    this.root = {
      used: true,
      x: 0,
      y: 0,
      width: this.root.width + width,
      height: this.root.height,
      down: this.root,
      right: { x: this.root.width, y: 0, width, height: this.root.height }
    };
    const node = this.#findNode(this.root, width, height);

    return node ? this.#splitNode(node, width, height) : false;
  }

  #growBottom(width: number, height: number): Node | null {
    this.root = {
      used: true,
      x: 0,
      y: 0,
      width: this.root.width,
      height: this.root.height + height,
      down: { x: 0, y: this.root.height, width: this.root.width, height },
      right: this.root
    };
    const node = this.#findNode(this.root, width, height);

    return node ? this.#splitNode(node, width, height) : null;
  }
}
