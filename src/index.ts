import { Buffer } from 'node:buffer';
import os from 'node:os';
import path from 'node:path';
import { format } from 'node:util';
import { resolveConfig, resolveModes } from './config.ts';
import { SpriteFile } from './file.ts';
import type { SpriteFileLike } from './file.ts';
import { SvgSpriteLayouter } from './layouter.ts';
import { SvgSpriterQueue } from './queue.ts';
import type { SvgShape } from './shape.ts';
import type {
  CompileOutput,
  Logger,
  ModeFiles,
  ModeMap,
  MustacheData,
  ResolvedConfig,
  ResolvedModeConfig,
  SpriteResult,
  SpriterConfig,
  SpriterContext
} from './types.ts';
import { ArgumentError } from './errors/argument-error.ts';
import { formatSize } from './utils/format-size.ts';
import { trimStart } from './utils/guards.ts';
import { runPool } from './utils/pool.ts';

export type * from './types.ts';
export { ArgumentError } from './errors/argument-error.ts';
export { DimensionsCalculationError } from './errors/dimensions-calculation-error.ts';
export { NotPermittedError } from './errors/not-permitted-error.ts';
export { XmlFixingError } from './errors/xml-fixing-error.ts';
export { SpriteFile } from './file.ts';
export type { SpriteFileLike } from './file.ts';
export { ConsoleLogger } from './logger.ts';
export { resolveConfig } from './config.ts';
export { SvgShape } from './shape.ts';

/** SVG spriter */
export class SvgSpriter implements SpriterContext {
  readonly config: ResolvedConfig;
  readonly shapes: SvgShape[] = [];
  readonly limit: number = Math.max(os.cpus().length * 2, 1);
  readonly #queue: SvgSpriterQueue;
  #namespacePow: number[] = [];
  #compiling: Promise<unknown> = Promise.resolve();

  constructor(config: SpriterConfig = {}) {
    this.config = resolveConfig(config);
    this.#queue = new SvgSpriterQueue(this);

    this.info('Using %d threads', this.limit);
    this.info('Created spriter instance');
  }

  /**
   * Add an SVG file to the spriter.
   *
   * @param file  A file object (`path`, `base`, `contents`; Vinyl files work), or the absolute file path
   * @param name  Local part of the file path (with a file path as first argument)
   * @param svg   SVG contents (with a file path as first argument)
   */
  add(file: SpriteFileLike | string, name?: string, svg?: string | Uint8Array): this {
    if (typeof file === 'string') {
      file = this.#createFile(file, name, svg);
    } else if (
      typeof file !== 'object' ||
      file === null ||
      !('path' in file) ||
      !('contents' in file)
    ) {
      throw this.#argumentError('SvgSpriter.add: You must provide a file object or a file path');
    }

    const spriteFile = new SpriteFile({
      path: file.path,
      base: path.resolve(file.base),
      contents: file.contents
    });

    this.#queue.add(spriteFile);

    return this;
  }

  #argumentError(message: string): ArgumentError {
    const error = new ArgumentError(message);

    this.error(message, error);

    return error;
  }

  #createFile(filePath: string, name = '', svg?: string | Uint8Array): SpriteFile {
    let file = filePath.trim();
    let localName = name;
    let errorMessage: string | null = null;

    // If the name part of the file path is absolute
    if (localName && path.isAbsolute(localName)) {
      errorMessage = format('SvgSpriter.add: "%s" is not a valid relative file name', localName);
    } else {
      if (localName) {
        localName = trimStart(localName.trim(), `${path.sep}.`);
      }

      localName ||= path.basename(file);

      const contents = (svg === undefined ? '' : Buffer.from(svg).toString()).trim();

      // Argument validation
      if (svg === undefined) {
        errorMessage = 'SvgSpriter.add: You must provide 3 arguments';
      } else if (file.length === 0) {
        errorMessage = format('SvgSpriter.add: "%s" is not a valid absolute file name', file);
      } else if (localName.length === 0) {
        errorMessage = format('SvgSpriter.add: "%s" is not a valid relative file name', localName);
      } else if (contents.length === 0) {
        errorMessage = 'SvgSpriter.add: You must provide SVG contents';
      } else if (!file.endsWith(localName)) {
        errorMessage = format(
          'SvgSpriter.add: "%s" is not the local part of "%s"',
          localName,
          file
        );
      }

      if (!errorMessage) {
        // Resolve path before splitting it into base and path so that the shape name can be extracted later on
        file = path.resolve(file);

        return new SpriteFile({
          base: file.slice(0, file.length - localName.length),
          path: file,
          contents: Buffer.from(contents)
        });
      }
    }

    throw this.#argumentError(errorMessage);
  }

  /**
   * Compile the added shapes into sprites.
   *
   * @param config  Mode configurations (defaults to the modes given to the constructor). An empty object runs
   *                without a mode, which only returns the intermediate SVG files (if configured).
   */
  compile(config?: ModeMap): Promise<CompileOutput> {
    const modes = config === undefined ? this.config.mode : resolveModes(config);
    const run = this.#compiling.then(() => this.#compile(modes));

    this.#compiling = run.catch(() => undefined);

    return run;
  }

  async #compile(modes: Readonly<Record<string, ResolvedModeConfig>>): Promise<CompileOutput> {
    // Wait for all shapes to be processed
    await this.#queue.idle();

    const result: SpriteResult = {};

    // If this is a modeless run
    if (Object.keys(modes).length === 0) {
      if (this.config.shape.dest) {
        result.shapes = this.#getShapeFiles(this.config.shape.dest);
        this.verbose('Returning %d intermediate SVG files', result.shapes.length);
      }

      this.#logStats(result);

      return { result, data: {} };
    }

    const masterShapes = this.shapes.filter((shape) => !shape.master);
    this.info('Compiling %d shapes...', masterShapes.length);

    // Initialize the namespace powers
    while (
      this.#namespacePow.length === 0 ||
      26 ** this.#namespacePow.length < masterShapes.length
    ) {
      this.#namespacePow.unshift(26 ** this.#namespacePow.length);

      for (const shape of this.shapes) {
        shape.resetNamespace();
      }
    }

    // Sort shapes by ID
    this.shapes.sort(this.config.shape.sort);

    // Set the shape namespaces on all master shapes
    for (const [index, shape] of this.shapes.filter((candidate) => !candidate.master).entries()) {
      await shape.setNamespace(this.#indexNamespace(index));
    }

    const files: Record<string, ModeFiles> = {};
    const layouter = new SvgSpriteLayouter(this, modes);
    const entries = Object.entries(modes);
    const layouts = await runPool(
      entries.map(
        ([key, mode]) =>
          () =>
            layouter.layout(files, key, mode.mode)
      ),
      this.limit
    );
    const data: Record<string, MustacheData> = {};

    for (const layout of layouts) {
      data[layout.key ?? layout.mode ?? ''] = layout;
    }

    Object.assign(result, files);

    // Add intermediate SVG files
    if (this.config.shape.dest) {
      result.shapes = this.#getShapeFiles(this.config.shape.dest);
      this.verbose('Returning %d intermediate SVG files', result.shapes.length);
    }

    this.info(
      'Finished %s sprite compilation',
      Object.keys(data)
        .map((mode) => `«${mode}»`)
        .join(' + ')
    );

    this.#logStats(result);

    return { result, data };
  }

  #indexNamespace(index: number): string {
    let namespace = '';
    let remaining = index;

    for (const namespacePow of this.#namespacePow) {
      const charCode = Math.floor(remaining / namespacePow);

      namespace += String.fromCodePoint(97 + charCode);
      remaining -= charCode * namespacePow;
    }

    return namespace;
  }

  /** Get the intermediate SVG files of all shapes (once they have been processed) */
  async getShapes(dest: string): Promise<SpriteFile[]> {
    await this.#queue.idle();

    return this.#getShapeFiles(dest);
  }

  #getShapeFiles(dest: string): SpriteFile[] {
    return this.shapes.map(
      (shape) =>
        new SpriteFile({
          base: this.config.dest,
          path: path.join(dest, `${shape.id}.svg`),
          contents: Buffer.from(shape.getSVG(false))
        })
    );
  }

  #logStats(result: SpriteResult): void {
    const sizes = new Map<string, string>();
    const extensions = new Map<string, number>();

    for (const group of Object.values(result)) {
      const resources = Array.isArray(group) ? group : Object.values(group ?? {});

      for (const resource of resources) {
        if (!resource) {
          continue;
        }

        const extension = path.extname(resource.path).toUpperCase();

        extensions.set(extension, (extensions.get(extension) ?? 0) + 1);
        sizes.set(resource.relative, formatSize(resource.contents.length));
      }
    }

    this.info(
      'Created %s',
      [...extensions].map(([extension, count]) => `${count} x ${extension.slice(1)}`).join(', ')
    );

    for (const [file, size] of [...sizes].toSorted(([a], [b]) => (a > b ? 1 : -1))) {
      this.verbose('Created %s: %s', file, size);
    }
  }

  info(...args: Parameters<Logger['info']>): void {
    this.config.log.info(...args);
  }

  verbose(...args: Parameters<Logger['verbose']>): void {
    this.config.log.verbose(...args);
  }

  debug(...args: Parameters<Logger['debug']>): void {
    this.config.log.debug(...args);
  }

  error(...args: Parameters<Logger['error']>): void {
    this.config.log.error(...args);
  }
}
