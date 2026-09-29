import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SpriterConfig } from '../types.ts';
import { isPlainObject } from '../utils/guards.ts';
import { deepMerge } from '../utils/merge.ts';
import type { CliOption } from './schema.ts';

type Store = Record<string, unknown>;

const SPRITE_MODES = ['css', 'view', 'defs', 'symbol', 'stack'] as const;
const RENDER_TYPES = ['css', 'scss', 'less', 'styl'] as const;

/** Parsed command line arguments */
export type CliArguments = Readonly<Record<string, unknown>>;

const message = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).trim();

/** Store a value at a dotted path */
function addConfigMap(store: Store, keys: readonly string[], value: unknown): void {
  const [key, ...rest] = keys;

  if (key === undefined) {
    return;
  }

  if (rest.length > 0) {
    let child = store[key];

    if (!isPlainObject(child)) {
      child = {};
      store[key] = child;
    }

    addConfigMap(child as Store, rest, value);
  } else {
    store[key] = value;
  }
}

function child(store: Store, key: string): Store {
  const value = store[key];

  return isPlainObject(value) ? (value as Store) : {};
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(file), 'utf8'));
}

/**
 * Turn the parsed command line arguments into a spriter configuration.
 *
 * @param argv     Parsed arguments
 * @param options  Flattened CLI options (`map` connects an option to its configuration path)
 */
export async function buildConfig(
  argv: CliArguments,
  options: readonly CliOption[]
): Promise<SpriterConfig> {
  let config: Store = {};
  let jsonConfig: Store = { mode: {} };

  // Map all arguments to a global configuration object
  for (const option of options) {
    if (option.map === undefined) {
      continue;
    }

    const key = option.alias ?? option.name;
    const value = argv[key] ?? argv[option.name];

    if (value !== undefined) {
      addConfigMap(config, option.map.split('.'), value);
    }
  }

  // Load external JSON config file
  const configFile = argv['config'];

  if (typeof configFile === 'string' && configFile) {
    try {
      const content = await readFile(path.resolve(configFile), 'utf8');
      const externalConfig = JSON.parse(content) as Store;

      // Keep a clone of the initial config for option removal checks
      jsonConfig = JSON.parse(content) as Store;

      if (!isPlainObject(jsonConfig['mode'])) {
        jsonConfig['mode'] = {};
      }

      // Expand shorthand mode definitions
      if (isPlainObject(externalConfig['mode'])) {
        const modes = externalConfig['mode'] as Store;

        for (const [name, value] of Object.entries(modes)) {
          if (value === true) {
            modes[name] = { render: { css: true } };
            (jsonConfig['mode'] as Store)[name] = { render: { css: true } };
          }
        }
      }

      config = deepMerge(config, externalConfig);
    } catch (error) {
      console.error('[ERROR] Skipping --config file due to errors ("%s")', message(error));
    }
  }

  const shape = child(config, 'shape');
  const svg = child(config, 'svg');
  const modes = child(config, 'mode');
  const jsonModes = child(jsonConfig, 'mode');

  config['shape'] = shape;
  config['svg'] = svg;
  config['mode'] = modes;

  // Refine particular config options
  const spacing = child(shape, 'spacing');
  const rawPadding = spacing['padding'];
  const padding = (
    Array.isArray(rawPadding)
      ? rawPadding.join(',')
      : String((rawPadding as string | number | undefined) ?? '')
  ).trim();

  spacing['padding'] =
    padding.length > 0 ? padding.split(',').map((dim) => Number.parseFloat(dim || '0')) : [];
  shape['spacing'] = spacing;

  if (typeof svg['rootAttributes'] === 'string') {
    try {
      svg['rootAttributes'] = await readJson(svg['rootAttributes']);
    } catch (error) {
      console.error('[ERROR] Skipping --svg-rootattrs file due to errors ("%s")', message(error));
      svg['rootAttributes'] = {};
    }
  }

  // Expand transformation options
  if (typeof shape['transform'] === 'string') {
    const transforms: unknown[] = [];

    for (const name of shape['transform'].split(',').map((transform) => transform.trim())) {
      if (name.length === 0) {
        continue;
      }

      const transformConfigFile = argv[`shape-transform-${name}`];

      if (typeof transformConfigFile === 'string') {
        try {
          const json = (await readFile(path.resolve(transformConfigFile), 'utf8')).trim();

          transforms.push({ [name]: json ? (JSON.parse(json) as unknown) : {} });
        } catch {
          // Ignore unreadable transformer configurations
        }
      } else {
        transforms.push(name);
      }
    }

    shape['transform'] = transforms;
  }

  // Run through all sprite modes
  for (const mode of SPRITE_MODES) {
    const modeConfig = child(modes, mode);

    if (!argv[mode] && !(mode in jsonModes)) {
      delete modes[mode];
      continue;
    }

    const jsonMode = child(jsonModes, mode);
    const jsonRender = child(jsonMode, 'render');
    const render = child(modeConfig, 'render');

    // Remove excessive render types
    for (const type of RENDER_TYPES) {
      if (type in render && !argv[`${mode}-render-${type}`] && !(type in jsonRender)) {
        delete render[type];
      }
    }

    modeConfig['render'] = render;

    if (typeof modeConfig['dimensions'] === 'string' && modeConfig['dimensions'].length === 0) {
      modeConfig['dimensions'] = true;
    }

    modes[mode] = modeConfig;
  }

  // Remove excessive example options
  for (const [mode, value] of Object.entries(modes)) {
    if (
      isPlainObject(value) &&
      !argv[`${mode}-example`] &&
      !('example' in child(jsonModes, mode)) &&
      'example' in value
    ) {
      delete (value as Store)['example'];
    }
  }

  // Read & parse Mustache variable JSON file
  if ('variables' in config) {
    const variables = String(config['variables']).trim();

    delete config['variables'];

    const variablesFile = variables.length > 0 ? path.resolve(variables) : null;

    if (variablesFile && existsSync(variablesFile)) {
      try {
        config['variables'] = await readJson(variablesFile);
      } catch (error) {
        console.error('[ERROR] Skipping --variables file due to errors ("%s")', message(error));
      }
    }
  }

  return config as SpriterConfig;
}
