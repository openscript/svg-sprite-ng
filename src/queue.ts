import path from 'node:path';
import type { SpriteFile } from './file.ts';
import { SvgShape } from './shape.ts';
import { svgoTransform } from './transform/svgo.ts';
import type { SpriterContext } from './types.ts';
import { isFunction, isObject } from './utils/guards.ts';
import { TaskQueue } from './utils/pool.ts';

/** Processing queue for the added SVG files. */
export class SvgSpriterQueue {
  readonly #spriter: SpriterContext;
  readonly #queue: TaskQueue;

  constructor(spriter: SpriterContext) {
    this.#spriter = spriter;
    this.#queue = new TaskQueue(spriter.limit);
    spriter.debug('Created processing queue instance');
  }

  /** Number of files that are still being processed */
  get active(): number {
    return this.#queue.active;
  }

  add(file: SpriteFile): void {
    const name = file.path.slice(file.base.length + path.sep.length);

    this.#spriter.debug('Added "%s" to processing queue', name);
    this.#queue.add(async () => {
      let shape: SvgShape;

      // Instantiate the shape; in case of errors: skip the file
      try {
        shape = new SvgShape(file, this.#spriter);
      } catch (error) {
        this.#spriter.error(
          'Skipping "%s" (%s)',
          name,
          error instanceof Error ? error.message : String(error)
        );
        return;
      }

      // Run through all optimization and compilation tasks
      await this.#transform(shape);
      await shape.complement();
      this.#spriter.shapes.push(...shape.distribute());
    });
  }

  async #transform(shape: SvgShape): Promise<void> {
    for (const [name, transform] of this.#spriter.config.shape.transform) {
      if (isFunction(transform)) {
        await transform(shape, this.#spriter);
      } else if (name === 'svgo' && isObject(transform)) {
        await svgoTransform(shape, transform, this.#spriter);
      }
    }
  }

  /** Wait until the queue has been processed */
  idle(): Promise<void> {
    return this.#queue.idle();
  }
}
