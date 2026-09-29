import fs from 'node:fs';
import { format } from 'node:util';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { createLogger } from './logger.ts';
import type {
  BoxSizing,
  Logger,
  ModeConfig,
  ModeMap,
  Padding,
  ResolvedConfig,
  ResolvedModeConfig,
  ResolvedShapeConfig,
  ResolvedShapeIdConfig,
  ResolvedShapeMeta,
  ResolvedSvgConfig,
  ResolvedTransform,
  ShapeConfig,
  ShapeIdGenerator,
  ShapeSorter,
  SpriteType,
  SpriterConfig,
  SvgConfig,
  SvgTransformer
} from './types.ts';
import { isFunction, isObject, isPlainObject, isString } from './utils/guards.ts';

export const SPRITE_TYPES: ReadonlySet<string> = new Set<SpriteType>([
  'css',
  'view',
  'defs',
  'symbol',
  'stack'
]);

const DEFAULT_SHAPE_TRANSFORM: readonly string[] = ['svgo'];

const DEFAULT_SVG_CONFIG: ResolvedSvgConfig = {
  doctypeDeclaration: true,
  xmlDeclaration: true,
  namespaceIDs: true,
  namespaceIDPrefix: '',
  namespaceClassnames: true,
  dimensionAttributes: true,
  rootAttributes: {},
  precision: -1,
  transform: []
};

/** Create a shape ID generator from a `util.format` style template. */
export function createIdGenerator(template: string): ShapeIdGenerator {
  return function generator(this: ResolvedShapeIdConfig, name: string): string {
    const pathname = this.separator ? name.split(path.sep).join(this.separator) : name;
    return format(
      template || '%s',
      path.basename(pathname.replaceAll(/\s+/g, this.whitespace), '.svg')
    );
  };
}

const defaultSorter: ShapeSorter = (shape1, shape2) =>
  shape1.id === shape2.id ? 0 : shape1.id > shape2.id ? 1 : -1;

/** Read a YAML file given by (possibly symlinked) path. Returns `null` if the path is not a file. */
function readYamlFile(file: string): Record<string, unknown> | null {
  let target = file;
  let stat = fs.lstatSync(target);

  if (stat.isSymbolicLink()) {
    target = fs.readlinkSync(target);
    stat = fs.statSync(target);
  }

  if (!stat.isFile()) {
    return null;
  }

  const content = fs.readFileSync(target, 'utf8');
  const parsed = content ? loadYaml(content) : {};

  return isPlainObject(parsed) ? parsed : {};
}

function resolveMetaData(shape: ShapeConfig, log: Logger): Record<string, ResolvedShapeMeta> {
  if (!isString(shape.meta)) {
    return {};
  }

  const metaFile = path.resolve(shape.meta);
  const meta = readYamlFile(metaFile);

  if (!meta) {
    return {};
  }

  const result: Record<string, ResolvedShapeMeta> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (isPlainObject(value)) {
      const { title, description } = value as { title?: string; description?: string };
      result[path.join(path.dirname(key), path.basename(key, '.svg'))] = { title, description };
    }
  }

  log.debug('Processed meta data file "%s"', path.basename(metaFile));

  return result;
}

function resolveAlignmentData(
  shape: ShapeConfig,
  log: Logger
): Record<string, Record<string, number>> {
  const alignmentData: Record<string, Record<string, number>> = { '*': { '%s': 0 } };

  if (!isString(shape.align)) {
    return alignmentData;
  }

  const alignFile = path.resolve(shape.align);
  const align = readYamlFile(alignFile);

  if (!align) {
    return alignmentData;
  }

  for (const [key, value] of Object.entries(align)) {
    if (!isPlainObject(value) || Object.keys(value).length === 0) {
      continue;
    }

    const file = path.join(path.dirname(key), path.basename(key, '.svg'));
    const entry = (alignmentData[file] ??= {});

    for (const [tmpl, tmplValue] of Object.entries(value)) {
      const template = tmpl.length > 0 ? (tmpl.includes('%s') ? tmpl : `%s${tmpl}`) : '%s';
      entry[template] = Math.max(0, Math.min(1, Number.parseFloat(String(tmplValue))));
    }
  }

  log.debug('Processed alignment data file "%s"', path.basename(alignFile));

  return alignmentData;
}

function resolvePadding(padding: unknown): Padding {
  if (!Array.isArray(padding)) {
    const value =
      Math.max(0, Number.parseInt(String((padding as number | string | undefined) || 0), 10)) || 0;
    return { top: value, right: value, bottom: value, left: value };
  }

  const [top = 0, right = top, bottom = top, left = right] = (padding as number[]).map((n) =>
    Math.max(0, n)
  );

  switch (padding.length) {
    case 1: {
      return { top, right: top, bottom: top, left: top };
    }

    case 2: {
      return { top, right, bottom: top, left: right };
    }

    case 3: {
      return { top, right, bottom, left: right };
    }

    default: {
      return { top, right, bottom, left };
    }
  }
}

function resolveShapeTransforms(shape: ShapeConfig): ResolvedTransform[] {
  const transforms: readonly unknown[] = Array.isArray(shape.transform)
    ? shape.transform
    : DEFAULT_SHAPE_TRANSFORM;
  const result: ResolvedTransform[] = [];

  for (const entry of transforms) {
    let transform: unknown = entry;

    if (isString(transform)) {
      transform = { [transform]: true };
    } else if (isFunction(transform)) {
      transform = { custom: transform };
    }

    if (!isObject(transform)) {
      continue;
    }

    for (const [transformer, value] of Object.entries(transform)) {
      if (value === true) {
        result.push([transformer, {}]);
        break;
      }

      if (isObject(value) || isFunction(value)) {
        result.push([transformer, value]);
        break;
      }
    }
  }

  return result;
}

function resolveSvgTransforms(transform: SvgConfig['transform']): SvgTransformer[] {
  if (transform === undefined) {
    return [];
  }

  if (isFunction(transform)) {
    return [transform];
  }

  if (Array.isArray(transform)) {
    return transform.filter((entry): entry is SvgTransformer => isFunction(entry));
  }

  throw new TypeError('Expected transform property to be a function or array');
}

function resolveShape(config: SpriterConfig, dest: string, log: Logger): ResolvedShapeConfig {
  const shape: ShapeConfig = config.shape ?? {};

  const separator = shape.id?.separator ?? '--';
  const generatorOption = shape.id?.generator;
  const generator: ShapeIdGenerator = isFunction(generatorOption)
    ? (generatorOption)
    : createIdGenerator(
        isString(generatorOption)
          ? generatorOption + (generatorOption.includes('%s') ? '' : '%s')
          : '%s'
      );

  const shapeDest = shape.dest === undefined ? '' : String(shape.dest).trim();

  return {
    id: {
      separator,
      pseudo: shape.id?.pseudo ?? '~',
      whitespace: shape.id?.whitespace ?? '_',
      generator
    },
    dimension: {
      maxWidth: shape.dimension?.maxWidth ?? 2000,
      maxHeight: shape.dimension?.maxHeight ?? 2000,
      precision: shape.dimension?.precision ?? 2,
      attributes: shape.dimension?.attributes ?? false
    },
    spacing: {
      padding: resolvePadding(shape.spacing?.padding),
      box: (shape.spacing?.box ?? 'content') satisfies BoxSizing
    },
    meta: resolveMetaData(shape, log),
    align: resolveAlignmentData(shape, log),
    sort: isFunction(shape.sort) ? shape.sort : defaultSorter,
    dest: shapeDest.length > 0 ? path.resolve(dest, shapeDest) : null,
    transform: resolveShapeTransforms(shape)
  };
}

/** Resolve SVG options on top of a base (defaults or the global SVG options for mode specific overrides). */
export function resolveSvg(
  svg: SvgConfig = {},
  base: ResolvedSvgConfig = DEFAULT_SVG_CONFIG
): ResolvedSvgConfig {
  const merged = {
    ...base,
    ...svg,
    rootAttributes: { ...base.rootAttributes, ...svg.rootAttributes }
  };

  return {
    doctypeDeclaration: merged.doctypeDeclaration || false,
    xmlDeclaration: merged.xmlDeclaration || false,
    namespaceIDs: merged.namespaceIDs,
    namespaceIDPrefix: merged.namespaceIDPrefix,
    namespaceClassnames: merged.namespaceClassnames,
    dimensionAttributes: merged.dimensionAttributes || false,
    rootAttributes: merged.rootAttributes,
    precision: Math.max(-1, Number.parseInt(String(merged.precision || -1), 10)),
    transform: svg.transform === undefined ? base.transform : resolveSvgTransforms(svg.transform)
  };
}

/**
 * Pick out the valid modes of a mode map: `true` is expanded to an empty configuration, invalid or
 * disabled entries are dropped and the `mode` property is filled in from the key if necessary.
 */
export function resolveModes(modes: ModeMap = {}): Record<string, ResolvedModeConfig> {
  const filtered: Record<string, ResolvedModeConfig> = {};

  for (const [key, value] of Object.entries(modes)) {
    let modeConfig: ModeConfig | null = null;

    if (isPlainObject(value)) {
      modeConfig = value;
    } else if (value === true) {
      modeConfig = {};
    }

    const type = modeConfig?.mode ?? key;

    if (modeConfig && SPRITE_TYPES.has(type)) {
      filtered[key] = { ...modeConfig, mode: type as SpriteType };
    }
  }

  return filtered;
}

/** Normalize a user supplied spriter configuration into a fully resolved configuration. */
export function resolveConfig(config: SpriterConfig = {}): ResolvedConfig {
  const log = createLogger(config.log);
  log.debug('Started logging');

  const dest = path.resolve(config.dest || '.');
  log.debug('Prepared general options');

  const shape = resolveShape(config, dest, log);
  log.debug('Prepared `shape` options');

  const svg = resolveSvg(config.svg);
  log.debug('Prepared `svg` options');

  const mode = resolveModes(config.mode);
  log.debug('Prepared `mode` options');

  const variables = { ...config.variables };
  log.debug('Prepared `variables` options');
  log.verbose('Initialized spriter configuration');

  return { log, dest, shape, svg, mode, variables };
}
