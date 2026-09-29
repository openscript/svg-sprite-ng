import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import mustache from 'mustache';
import { SpriteFile } from '../file.ts';
import type { SvgSprite } from '../sprite.ts';
import type {
  ExampleOption,
  Layout,
  MustacheData,
  ModeFiles,
  RenderConfig,
  ResolvedSvgConfig,
  ShapeData,
  SpriteType,
  SpriterContext
} from '../types.ts';
import { isPlainObject } from '../utils/guards.ts';
import { runPool } from '../utils/pool.ts';
import { getTemplateRoot } from './templates.ts';

/** Mode configuration after merging the defaults and the user's options (paths not yet resolved). */
export interface MergedModeConfig {
  dest: string;
  sprite: string;
  prefix: string;
  dimensions: string | boolean;
  bust: boolean;
  svg: ResolvedSvgConfig;
  layout?: Layout;
  common?: string | null;
  mixin?: string | boolean | null;
  inline?: boolean;
  rootviewbox?: boolean;
  render?: RenderConfig;
  example?: ExampleOption;
  variables?: Record<string, unknown>;
}

export interface RenderTarget {
  template: string;
  dest: string;
}

/** Mode configuration with all paths resolved. */
export interface ModeSettings {
  dest: string;
  sprite: string;
  prefix: string;
  dimensions: string | boolean;
  bust: boolean;
  svg: ResolvedSvgConfig;
  layout: Layout;
  common: string | null;
  mixin: string | null;
  inline: boolean;
  rootviewbox: boolean;
  render: Record<string, RenderTarget>;
  example: RenderTarget | false;
}

const toPosix = (value: string): string => value.split(path.sep).join('/');

/**
 * Create shape data with a lazily built `svg` property that can be overwritten.
 */
export function withLazySvg(data: ShapeData, build: () => string): ShapeData {
  let override: string | undefined;

  return {
    ...data,
    get svg(): string {
      return override ?? build();
    },
    set svg(svg: string) {
      override = svg;
    }
  };
}

/** Sprite base class */
export abstract class SvgSpriteBase {
  protected readonly spriter: SpriterContext;
  readonly config: ModeSettings;
  readonly key: string;
  readonly mode: SpriteType;
  data: MustacheData;
  protected readonly cssDest: string;
  protected readonly tmpl: string;

  /**
   * @param spriter  SVG spriter
   * @param config   Merged mode configuration
   * @param data     Base data
   * @param key      Mode key
   * @param mode     Mode
   * @param tmpl     Template directory
   */
  constructor(
    spriter: SpriterContext,
    config: MergedModeConfig,
    data: MustacheData,
    key: string | undefined,
    mode: SpriteType,
    tmpl = 'common'
  ) {
    this.spriter = spriter;
    this.mode = mode;
    this.tmpl = tmpl;
    this.key = key || mode;
    this.data = data;
    this.data.mode = mode;
    this.data.key = this.key;

    const dest = path.resolve(spriter.config.dest, config.dest);

    // Resolve the sprite path
    const spriteDir = path.dirname(config.sprite);
    let spriteName = path.basename(config.sprite) || 'sprite';

    if (!spriteName.includes('.')) {
      spriteName += '.svg';
    }

    const prefix = config.prefix.trim();

    this.config = {
      dest,
      sprite: path.resolve(dest, path.join(spriteDir, spriteName)),
      // Prepare the CSS prefix
      prefix: /%s/.test(prefix.split('%%').join('')) ? prefix : `${prefix}%s`,
      dimensions: config.dimensions,
      bust: config.bust,
      svg: config.svg,
      layout: config.layout ?? 'packed',
      common: config.common ?? null,
      mixin: null,
      inline: Boolean(config.inline),
      rootviewbox: config.rootviewbox !== false,
      render: this.#resolveRender(config.render, dest),
      example: false
    };

    this.cssDest = this.config.render['css'] ? path.dirname(this.config.render['css'].dest) : dest;

    // Refine the base data
    this.config.example = this.#resolveExample(config.example);
    this.data = {
      ...this.data,
      padding: spriter.config.shape.spacing.padding,
      sprite: toPosix(path.relative(this.cssDest, this.config.sprite))
    };

    if (this.config.example) {
      this.data.example = toPosix(
        path.relative(path.dirname(this.config.example.dest), this.config.sprite)
      );
    }

    this.spriter.debug('Created «%s» sprite instance («%s» mode)', this.key, this.mode);

    this.mixinOption = config.mixin;
  }

  /** The raw `mixin` option (interpreted by CSS modes) */
  protected mixinOption: string | boolean | null | undefined;

  /** Prepare the rendering configurations */
  #resolveRender(render: RenderConfig | undefined, dest: string): Record<string, RenderTarget> {
    const result: Record<string, RenderTarget> = {};

    if (!isPlainObject(render)) {
      return result;
    }

    for (const [extension, value] of Object.entries(render)) {
      const target: RenderTarget = {
        template: path.resolve(getTemplateRoot(), this.tmpl, `sprite.${extension}`),
        dest: path.join(dest, `sprite.${extension}`)
      };

      if (isPlainObject(value)) {
        if (typeof value['template'] === 'string') {
          target.template = path.resolve(process.cwd(), value['template']);
        }

        if (typeof value['dest'] === 'string') {
          target.dest = path.resolve(dest, value['dest']);

          if (!new RegExp(`\\.${extension}$`, 'i').test(target.dest)) {
            target.dest += `.${extension}`;
          }
        }
      } else if (value !== true) {
        continue;
      }

      result[extension] = target;
    }

    return result;
  }

  /** Prepare the HTML example configuration */
  #resolveExample(example: ExampleOption | undefined): RenderTarget | false {
    if (!example) {
      return false;
    }

    const target: RenderTarget = {
      template: path.resolve(getTemplateRoot(), this.mode, 'sprite.html'),
      dest: path.join(this.config.dest, `sprite.${this.key}.html`)
    };

    if (isPlainObject(example)) {
      if (typeof example['template'] === 'string') {
        target.template = path.resolve(process.cwd(), example['template']);
      }

      if (typeof example['dest'] === 'string') {
        target.dest = path.resolve(this.config.dest, example['dest']);
      }
    } else if (example !== true) {
      return false;
    }

    return target;
  }

  /** Layout the sprite and render all resources */
  abstract layout(files: ModeFiles): Promise<MustacheData>;

  /** Build the configured CSS resources */
  protected async buildCssResources(files: ModeFiles): Promise<void> {
    const tasks = Object.entries(this.config.render).map(([extension, target]) => async () => {
      const out = mustache.render(await readFile(target.template, 'utf8'), this.data);

      if (out.length > 0) {
        files[extension] = new SpriteFile({
          base: this.spriter.config.dest,
          path: target.dest,
          contents: Buffer.from(out)
        });
        this.spriter.verbose('Created «%s» stylesheet resource', extension);
      }
    });

    await runPool(tasks, this.spriter.limit);
  }

  /** Build the HTML example (non-CSS modes) */
  protected async buildHtmlExample(files: ModeFiles): Promise<MustacheData> {
    if (this.config.example) {
      const out = mustache.render(await readFile(this.config.example.template, 'utf8'), this.data);

      if (out.length > 0) {
        files['example'] = new SpriteFile({
          base: this.spriter.config.dest,
          path: this.config.example.dest,
          contents: Buffer.from(out)
        });
        this.spriter.verbose('Created «%s» HTML example file', this.key);
      }
    }

    return this.data;
  }

  /** Return a coordinate (number) with a unit appended if non-zero */
  protected addUnit(number: number, unit: string): string {
    return `${number}${number === 0 ? '' : unit}`;
  }

  /** Evaluate and return a declaration value */
  declaration(global: boolean | string | undefined, local: string | undefined): string {
    if (global === true) {
      return local || '';
    }

    return (global || '').trim();
  }

  /** Add cache busting and return the sprite path */
  protected addCacheBusting(svg: SvgSprite): string {
    if (!this.config.bust) {
      return this.config.sprite;
    }

    const hash = crypto.createHash('md5').update(svg.toString(), 'utf8').digest('hex').slice(0, 8);
    const extension = path.extname(this.config.sprite);
    const filename = `${path.basename(this.config.sprite, extension)}-${hash}${extension}`;
    const spriteFullPath = path.join(path.dirname(this.config.sprite), filename);

    this.data.sprite = toPosix(path.relative(this.cssDest, spriteFullPath));

    if (this.config.example) {
      this.data.example = toPosix(
        path.relative(path.dirname(this.config.example.dest), spriteFullPath)
      );
    }

    return spriteFullPath;
  }
}
