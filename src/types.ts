import type { Config as SvgoConfig } from 'svgo';
import type { SpriteFile, SpriteFileLike } from './file.ts';
import type { SvgShape } from './shape.ts';

export type { SpriteFile, SpriteFileLike } from './file.ts';
export type { SvgoConfig };

/* ------------------------------------------------------------------------------------------------
 * Logging
 * ---------------------------------------------------------------------------------------------- */

export type LogLevel = 'info' | 'verbose' | 'debug';

/** Minimal logger. Messages use `util.format` style placeholders (`%s`, `%d`). A winston instance satisfies it. */
export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  verbose: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/** `false` silences logging, `true` logs at `info` level. */
export type LogOption = boolean | LogLevel | Logger;

/* ------------------------------------------------------------------------------------------------
 * Shape configuration
 * ---------------------------------------------------------------------------------------------- */

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Shape ID generator. Invoked with the `id` configuration as `this`. */
export type ShapeIdGenerator = (
  this: ResolvedShapeIdConfig,
  name: string,
  file: SpriteFile
) => string;

export interface ShapeIdConfig {
  /** ID part separator (used for directory-to-ID traversal) */
  separator?: string;
  /** Pseudo selector separator */
  pseudo?: string;
  /** Whitespace replacement string */
  whitespace?: string;
  /** ID generator callback or a template string containing `%s` */
  generator?: string | ShapeIdGenerator;
}

export interface ShapeDimensionConfig {
  maxWidth?: number;
  maxHeight?: number;
  /** Coordinate decimal places */
  precision?: number;
  /** Add dimension attributes */
  attributes?: boolean;
}

export type BoxSizing = 'content' | 'padding' | 'icon';

export interface ShapeSpacingConfig {
  /** Padding around the shape: one value or a CSS-like list of 1 to 4 values */
  padding?: number | readonly number[];
  box?: BoxSizing;
}

/** Custom shape transformer. */
export type ShapeTransformer = (shape: SvgShape, spriter: SpriterContext) => Promise<void> | void;

export type SvgoTransformConfig = SvgoConfig;

/** Entries of `shape.transform`: a name (`'svgo'`), a custom function, or an object mapping names to options. */
export type ShapeTransformEntry =
  | string
  | ShapeTransformer
  | { svgo?: true | SvgoTransformConfig; custom?: ShapeTransformer; [name: string]: unknown };

export type ShapeSorter = (shape1: SvgShape, shape2: SvgShape) => number;

export interface ShapeConfig {
  id?: ShapeIdConfig;
  dimension?: ShapeDimensionConfig;
  spacing?: ShapeSpacingConfig;
  /** Path of a YAML file with shape meta data (title, description) */
  meta?: string | boolean;
  /** Path of a YAML file with shape alignment data */
  align?: string | boolean;
  sort?: ShapeSorter;
  /** Intermediate SVG destination directory */
  dest?: string;
  transform?: readonly ShapeTransformEntry[];
}

/* ------------------------------------------------------------------------------------------------
 * SVG configuration
 * ---------------------------------------------------------------------------------------------- */

/** Post-processing transformer for the serialized sprite SVG. */
export type SvgTransformer = (svg: string) => string;

export interface SvgConfig {
  /** Add a DOCTYPE declaration to SVG documents (or use the given string) */
  doctypeDeclaration?: boolean | string;
  /** Add an XML declaration to SVG documents (or use the given string) */
  xmlDeclaration?: boolean | string;
  /** Namespace IDs in SVG documents to avoid ID clashes */
  namespaceIDs?: boolean;
  /** Prefix the usual alphabetical namespace IDs with a custom string */
  namespaceIDPrefix?: string;
  /** Namespace CSS class names in SVG documents to avoid CSS clashes */
  namespaceClassnames?: boolean;
  /** Add width and height attributes to the sprite SVG */
  dimensionAttributes?: boolean;
  /** Additional root attributes for the outermost `<svg>` element */
  rootAttributes?: Readonly<Record<string, string | number>>;
  /** Floating point precision for CSS positioning values (-1: unlimited) */
  precision?: number;
  transform?: SvgTransformer | readonly SvgTransformer[];
}

/* ------------------------------------------------------------------------------------------------
 * Mode configuration
 * ---------------------------------------------------------------------------------------------- */

export type SpriteType = 'css' | 'view' | 'defs' | 'symbol' | 'stack';

export interface RenderOptions {
  /** Mustache template (relative to the current working directory) */
  template?: string;
  /** Output file (relative to the mode's `dest`) */
  dest?: string;
}

/** `true` renders with the default template and destination. */
export type RenderEntry = boolean | RenderOptions;

/** Stylesheet renderers by file extension (`css`, `scss`, `less`, `styl`, or custom ones). */
export type RenderConfig = Partial<Record<string, RenderEntry>>;

export type ExampleOption = boolean | RenderOptions;

export type Layout = 'vertical' | 'horizontal' | 'diagonal' | 'packed';

export interface BaseModeConfig {
  /** Mode specific output directory */
  dest?: string;
  /** CSS selector prefix for all shapes (including placeholders) */
  prefix?: string;
  /** Sprite path and filename (relative to `dest`) */
  sprite?: string;
  /** Enable cache busting */
  bust?: boolean;
  /** Mode specific SVG options */
  svg?: SvgConfig;
  /** Mode specific Mustache variables */
  variables?: Record<string, unknown>;
}

export interface CssLikeModeConfig extends BaseModeConfig {
  layout?: Layout;
  /** Common CSS rule selector for all shapes */
  common?: string | null;
  /** Preprocessor mixin name with properties for all shapes (`true`: use `common`) */
  mixin?: string | boolean | null;
  /** CSS selector suffix for shape dimension rules (`true`: inline) */
  dimensions?: string | boolean;
  render?: RenderConfig;
  example?: ExampleOption;
}

export interface CssModeConfig extends CssLikeModeConfig {
  mode?: 'css';
}

export interface ViewModeConfig extends CssLikeModeConfig {
  mode?: 'view';
}

export interface StandaloneModeConfig extends BaseModeConfig {
  /** CSS selector suffix for shape dimension rules */
  dimensions?: string | boolean;
  render?: RenderConfig;
  example?: ExampleOption;
}

export interface DefsModeConfig extends StandaloneModeConfig {
  mode?: 'defs';
  /** Prepare for inline embedding into HTML documents */
  inline?: boolean;
}

export interface SymbolModeConfig extends StandaloneModeConfig {
  mode?: 'symbol';
  /** Prepare for inline embedding into HTML documents */
  inline?: boolean;
}

export interface StackModeConfig extends StandaloneModeConfig {
  mode?: 'stack';
  /** Set `false` to omit the root viewBox */
  rootviewbox?: boolean;
}

export type ModeConfig =
  | CssModeConfig
  | ViewModeConfig
  | DefsModeConfig
  | SymbolModeConfig
  | StackModeConfig;

/** A mode option: `true` is the shorthand for the mode's default configuration. */
export type ModeOption<T extends ModeConfig> = T | true;

/**
 * Sprite modes by name. The well-known names configure the mode of the same name; any other key
 * needs an explicit `mode` property.
 */
export interface ModeMap {
  css?: ModeOption<CssModeConfig> | false;
  view?: ModeOption<ViewModeConfig> | false;
  defs?: ModeOption<DefsModeConfig> | false;
  symbol?: ModeOption<SymbolModeConfig> | false;
  stack?: ModeOption<StackModeConfig> | false;
  [key: string]: ModeOption<ModeConfig> | false | undefined;
}

/* ------------------------------------------------------------------------------------------------
 * Spriter configuration
 * ---------------------------------------------------------------------------------------------- */

export interface SpriterConfig {
  /** Base directory for all output (default: current working directory) */
  dest?: string;
  log?: LogOption;
  shape?: ShapeConfig;
  svg?: SvgConfig;
  mode?: ModeMap;
  /** Global Mustache variables */
  variables?: Record<string, unknown>;
}

/* ------------------------------------------------------------------------------------------------
 * Resolved configuration
 * ---------------------------------------------------------------------------------------------- */

export interface ResolvedShapeIdConfig {
  readonly separator: string;
  readonly pseudo: string;
  readonly whitespace: string;
  readonly generator: ShapeIdGenerator;
}

export interface ResolvedShapeMeta {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}

export type ResolvedTransform = readonly [
  name: string,
  config: SvgoTransformConfig | ShapeTransformer | Record<string, unknown>
];

export interface ResolvedShapeConfig {
  readonly id: ResolvedShapeIdConfig;
  readonly dimension: Readonly<Required<ShapeDimensionConfig>>;
  readonly spacing: { readonly padding: Readonly<Padding>; readonly box: BoxSizing };
  readonly meta: Readonly<Record<string, ResolvedShapeMeta>>;
  /** Alignment templates by shape ID; `'*'` applies to all shapes */
  readonly align: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly sort: ShapeSorter;
  readonly dest: string | null;
  readonly transform: readonly ResolvedTransform[];
}

export interface ResolvedSvgConfig {
  readonly doctypeDeclaration: boolean | string;
  readonly xmlDeclaration: boolean | string;
  readonly namespaceIDs: boolean;
  readonly namespaceIDPrefix: string;
  readonly namespaceClassnames: boolean;
  readonly dimensionAttributes: boolean;
  readonly rootAttributes: Readonly<Record<string, string | number>>;
  readonly precision: number;
  readonly transform: readonly SvgTransformer[];
}

/** A mode configuration with its `mode` type filled in. */
export type ResolvedModeConfig = ModeConfig & { mode: SpriteType };

export interface ResolvedConfig {
  readonly log: Logger;
  readonly dest: string;
  readonly shape: ResolvedShapeConfig;
  readonly svg: ResolvedSvgConfig;
  readonly mode: Readonly<Record<string, ResolvedModeConfig>>;
  readonly variables: Readonly<Record<string, unknown>>;
}

/* ------------------------------------------------------------------------------------------------
 * Spriter context (what shapes, layouters and modes need from the spriter)
 * ---------------------------------------------------------------------------------------------- */

export interface SpriterContext extends Logger {
  readonly config: ResolvedConfig;
  readonly shapes: SvgShape[];
  readonly limit: number;
}

/* ------------------------------------------------------------------------------------------------
 * Results and Mustache data
 * ---------------------------------------------------------------------------------------------- */

/** Files of a single mode: the sprite, an optional HTML example and rendered stylesheets by extension. */
export interface ModeFiles {
  sprite?: SpriteFile;
  example?: SpriteFile;
  [extension: string]: SpriteFile | undefined;
}

export interface SpriteResult {
  /** Intermediate SVG files (if `shape.dest` is configured) */
  shapes?: SpriteFile[];
  [mode: string]: ModeFiles | SpriteFile[] | undefined;
}

export interface SelectorPart {
  expression: string;
  raw: string;
  first: boolean;
  last: boolean;
}

export interface ShapeSelectors {
  shape?: SelectorPart[];
  dimensions?: SelectorPart[];
}

export interface ShapePosition {
  absolute: { x: number; y: number; xy: string };
  relative?: { x: number; y: number; xy: string };
}

export interface ShapeData {
  name: string;
  base: string;
  master: string | null;
  width: { inner: number; outer: number };
  height: { inner: number; outer: number };
  first: boolean;
  last: boolean;
  fileSize: string | null;
  selector?: ShapeSelectors;
  position?: ShapePosition;
  dimensions?: { inline: boolean; extra: boolean };
  /** SVG of the shape (lazily built, can be overwritten) */
  svg: string;
}

/** Variables passed to the Mustache templates. */
export interface MustacheData {
  shapes: ShapeData[];
  date: string;
  mode?: SpriteType;
  key?: string;
  sprite?: string;
  example?: string;
  inline?: boolean;
  hasCommon?: boolean;
  common?: string | null;
  commonName?: string;
  hasMixin?: boolean;
  mixinName?: string | null;
  includeDimensions?: boolean;
  spriteWidth?: number;
  spriteHeight?: number;
  padding?: Readonly<Padding>;
  [variable: string]: unknown;
}

export interface CompileOutput {
  result: SpriteResult;
  /** Mustache data by mode key */
  data: Record<string, MustacheData>;
}

export type { SpriteFileLike as FileInput };
