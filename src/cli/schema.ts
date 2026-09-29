import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { getTemplateRoot } from '../mode/templates.ts';
import { isPlainObject } from '../utils/guards.ts';

/** A single CLI option (a node of the YAML schema) */
export interface OptionSchema {
  description?: string;
  alias?: string;
  default?: string | number | boolean;
  required?: boolean;
  map?: string;
  [child: string]: unknown;
}

/** A flattened CLI option */
export interface CliOption {
  /** Option name, e.g. `css-render-css-template` */
  name: string;
  /** Alias to use as the primary yargs key (falls back to `name`) */
  alias: string | undefined;
  description: string | undefined;
  default: string | number | boolean | undefined;
  required: boolean;
  /** Dotted path in the spriter configuration */
  map: string | undefined;
}

const OPTION_KEYS = new Set(['description', 'alias', 'default', 'required', 'map']);

/** Locate `options.yaml` next to the built CLI (or in `cli/` when running from the sources). */
async function readSchemaSource(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let lastError: unknown;

  for (const candidate of ['options.yaml', 'cli/options.yaml']) {
    try {
      return await readFile(path.resolve(here, candidate), 'utf8');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function flatten(name: string, node: OptionSchema, options: CliOption[]): void {
  if ('description' in node) {
    let defaultValue = node.default;

    // Default templates are relative to the package's template directory
    if (name.endsWith('-template') && typeof defaultValue === 'string') {
      defaultValue = path.resolve(getTemplateRoot(), defaultValue.replace(/^tmpl\//, ''));
    }

    options.push({
      name,
      alias: node.alias,
      description: node.description,
      default: defaultValue,
      required: Boolean(node.required),
      map: node.map
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (!OPTION_KEYS.has(key) && isPlainObject(value)) {
      flatten(`${name}-${key}`, value, options);
    }
  }
}

/** Load the YAML driven option schema and flatten it into a list of options. */
export async function loadOptions(): Promise<CliOption[]> {
  const schema = load(await readSchemaSource());
  const options: CliOption[] = [];

  if (!isPlainObject(schema)) {
    throw new TypeError('Invalid CLI option schema');
  }

  for (const [key, value] of Object.entries(schema)) {
    if (isPlainObject(value)) {
      flatten(key, value, options);
    }
  }

  return options;
}
