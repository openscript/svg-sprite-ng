import type { SvgSpriteBase } from './mode/base.ts';
import type { MergedModeConfig } from './mode/base.ts';
import { SvgSpriteCss } from './mode/css.ts';
import { SvgSpriteDefs } from './mode/defs.ts';
import { SvgSpriteStack } from './mode/stack.ts';
import { SvgSpriteSymbol } from './mode/symbol.ts';
import { SvgSpriteView } from './mode/view.ts';
import { resolveSvg } from './config.ts';
import type {
  ModeFiles,
  MustacheData,
  ResolvedModeConfig,
  ShapeData,
  SpriteType,
  SpriterContext
} from './types.ts';

type ModeDefaults = Omit<MergedModeConfig, 'svg'>;

const cssLikeDefaults = (mode: 'css' | 'view'): ModeDefaults => ({
  dest: mode,
  layout: 'packed',
  common: null,
  mixin: null,
  prefix: '.svg-%s',
  dimensions: '-dims',
  sprite: `svg/sprite.${mode}.svg`,
  bust: true
});

const standaloneDefaults = (mode: 'defs' | 'symbol' | 'stack'): ModeDefaults => ({
  dest: mode,
  prefix: '.svg-%s',
  dimensions: '-dims',
  sprite: `svg/sprite.${mode}.svg`,
  ...(mode === 'stack' ? {} : { inline: false }),
  example: false,
  bust: false
});

const DEFAULT_CONFIG: Readonly<Record<SpriteType, ModeDefaults>> = {
  css: cssLikeDefaults('css'),
  view: cssLikeDefaults('view'),
  defs: standaloneDefaults('defs'),
  symbol: standaloneDefaults('symbol'),
  stack: standaloneDefaults('stack')
};

type Render = (text: string) => string;

const DEFAULT_MUSTACHE_VARIABLES = {
  invert:
    () =>
    (num: string, render: Render): number =>
      -Number.parseFloat(render(num)),
  classname:
    () =>
    (str: string, render: Render): string => {
      const classname = render(str).replaceAll(/\s+/g, ' ').split(' ').pop() ?? '';

      return classname.startsWith('.') ? classname.slice(1) : classname;
    },
  escape:
    () =>
    (str: string, render: Render): string =>
      render(str).split('\\').join('\\\\'),
  encodeHashSign:
    () =>
    (str: string, render: Render): string =>
      render(str).split('#').join('%23')
};

/** Clone shape data, keeping getters/setters (such as `svg`) intact. */
function cloneShapeData(shape: ShapeData): ShapeData {
  return Object.defineProperties({} as ShapeData, Object.getOwnPropertyDescriptors(shape));
}

/** Lays out the shapes of a spriter into the configured modes. */
export class SvgSpriteLayouter {
  readonly #spriter: SpriterContext;
  readonly #config: Readonly<Record<string, ResolvedModeConfig>>;
  readonly #commonData: MustacheData;

  constructor(spriter: SpriterContext, config: Readonly<Record<string, ResolvedModeConfig>>) {
    this.#spriter = spriter;
    this.#config = config;
    this.#commonData = {
      shapes: [],
      date: new Date().toUTCString(),
      ...DEFAULT_MUSTACHE_VARIABLES,
      ...spriter.config.variables
    };

    // Register the common shapes data
    const lastShapeIndex = spriter.shapes.length - 1;

    for (const [index, shape] of spriter.shapes.entries()) {
      const { width, height } = shape.getDimensions();
      const { top, right, bottom, left } = shape.config.spacing.padding;

      this.#commonData.shapes.push({
        name: shape.id,
        base: shape.base,
        master: shape.master?.id ?? null,
        width: { inner: width - right - left, outer: width },
        height: { inner: height - top - bottom, outer: height },
        first: index === 0,
        last: index === lastShapeIndex,
        // 3.x never populated the file size (it looked up `example` on the mode map); kept for identical output
        fileSize: null,
        svg: ''
      });
    }

    spriter.debug('Created layouter instance');
  }

  /** Layout a single mode */
  async layout(
    files: Record<string, ModeFiles>,
    key: string,
    mode: SpriteType
  ): Promise<MustacheData> {
    this.#spriter.info('Laying out «%s» sprite («%s» mode)', key, mode);

    const userConfig = this.#config[key] ?? {};
    const {
      svg: modeSvg,
      variables,
      ...rest
    } = userConfig as ResolvedModeConfig & {
      variables?: Record<string, unknown>;
    };
    const config = {
      ...DEFAULT_CONFIG[mode],
      ...rest,
      svg: resolveSvg(modeSvg, this.#spriter.config.svg)
    } as MergedModeConfig;
    const data: MustacheData = {
      ...this.#commonData,
      shapes: this.#commonData.shapes.map((shape) => cloneShapeData(shape)),
      ...variables
    };
    const sprite = this.#createMode(mode, config, data, key);
    const modeFiles: ModeFiles = {};

    files[key] = modeFiles;

    return sprite.layout(modeFiles);
  }

  #createMode(
    mode: SpriteType,
    config: MergedModeConfig,
    data: MustacheData,
    key: string
  ): SvgSpriteBase {
    switch (mode) {
      case 'css': {
        return new SvgSpriteCss(this.#spriter, config, data, key);
      }

      case 'view': {
        return new SvgSpriteView(this.#spriter, config, data, key);
      }

      case 'defs': {
        return new SvgSpriteDefs(this.#spriter, config, data, key);
      }

      case 'symbol': {
        return new SvgSpriteSymbol(this.#spriter, config, data, key);
      }

      case 'stack': {
        return new SvgSpriteStack(this.#spriter, config, data, key);
      }
    }
  }
}
