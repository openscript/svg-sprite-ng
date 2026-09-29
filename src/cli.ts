import { lstat, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';
import yargs from 'yargs';
import type { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { SvgSpriter } from './index.ts';
import { buildConfig } from './cli/build-config.ts';
import { loadOptions } from './cli/schema.ts';
import type { CliOption } from './cli/schema.ts';
import { writeFiles } from './cli/write-files.ts';

/** Read the package version (the package.json is located above `dist` or `src`) */
async function readVersion(): Promise<string> {
  let directory = path.dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 3; depth++) {
    try {
      const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as {
        version?: string;
      };

      if (pkg.version) {
        return pkg.version;
      }
    } catch {
      // Try the parent directory
    }

    directory = path.dirname(directory);
  }

  return 'unknown';
}

function addOption(parser: Argv, option: CliOption): Argv {
  const key = option.alias ?? option.name;
  let result = parser;

  if (option.alias !== undefined) {
    result = result.alias(key, option.name);
  }

  if (option.description !== undefined) {
    result = result.describe(key, option.description);
  }

  if (option.default !== undefined) {
    result = result.default(key, option.default);

    if (typeof option.default === 'boolean') {
      result = result.boolean(option.name);
    }
  } else if (option.required) {
    result = result.demandOption(key);
  }

  return result;
}

async function resolveFiles(patterns: readonly string[]): Promise<string[]> {
  const files: string[] = [];

  for (const pattern of patterns) {
    files.push(...(await glob(pattern)));
  }

  return files;
}

async function main(args: readonly string[]): Promise<void> {
  const options = await loadOptions();
  let parser: Argv = yargs([...args])
    .usage(
      'Create one or multiple sprites of the given SVG files, optionally along with some stylesheet resources.\nUsage: $0 [options] files'
    )
    .version(await readVersion())
    .help('help', 'Display this help information')
    .wrap(null)
    .example(
      '$0 --css --css-render-css --css-example --dest=out assets/*.svg',
      'Create a CSS sprite of the given SVG files including example document to the subdirectory "out"'
    )
    .example('$0 -cD out --ccss --cx assets/*.svg', 'Same as above')
    .example(
      '$0 -cD out --cscss -p 10 assets/*.svg',
      'Render Sass instead of CSS and add 10px padding around all shapes (no example document this time)'
    )
    .showHelpOnFail(true)
    .demandCommand(1);

  for (const option of options) {
    parser = addOption(parser, option);
  }

  const argv: Record<string, unknown> = await parser.parseAsync();
  const config = await buildConfig(argv, options);
  const spriter = new SvgSpriter(config);
  const patterns = (argv['_'] as (string | number)[]).map(String);

  for (const match of await resolveFiles(patterns)) {
    let file = path.resolve(match);
    let basename = match;
    const stat = await lstat(file);

    if (stat.isSymbolicLink()) {
      file = await readlink(file);
      basename = path.basename(file);
    } else {
      const basepos = basename.lastIndexOf('./');

      basename = basepos === -1 ? path.basename(file) : basename.slice(basepos + 2);
    }

    spriter.add(file, basename, await readFile(file));
  }

  const { result } = await spriter.compile();

  await writeFiles(result);
}

try {
  await main(hideBin(process.argv));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
