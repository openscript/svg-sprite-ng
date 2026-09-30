import { execFile, execSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { paths } from './helpers/constants.ts';
import { removeTempPath } from './helpers/remove-temp-path.ts';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'dist/cli.js');
const fixtures = path.join(paths.fixtures, 'svg/single');
const tmpPath = path.join(paths.tmp, 'cli');

async function svgSprite(...args: string[]): Promise<{ stdout: string; stderr: string }> {
  return run(process.execPath, [cli, ...args], { cwd: root });
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
    )
    .toSorted();
}

describe('command line interface', () => {
  beforeAll(async () => {
    execSync('npm run build', { cwd: root, stdio: 'ignore' });
    await removeTempPath(tmpPath);
  }, 120_000);

  it('prints the help', async () => {
    const { stdout } = await svgSprite('--help');

    expect(stdout).toContain('Create one or multiple sprites of the given SVG files');
    expect(stdout).toContain('--css-render-scss');
  });

  it('prints the version', async () => {
    const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      version: string;
    };
    const { stdout } = await svgSprite('--version');

    expect(stdout.trim()).toBe(version);
  });

  it('fails without input files', async () => {
    await expect(svgSprite()).rejects.toMatchObject({ code: 1 });
  });

  it.each([
    [
      'css',
      [
        'css/sprite.css',
        'css/sprite.less',
        'css/sprite.scss',
        'css/sprite.styl',
        'css/sprite.css.html'
      ]
    ],
    [
      'view',
      [
        'view/sprite.css',
        'view/sprite.less',
        'view/sprite.scss',
        'view/sprite.styl',
        'view/sprite.view.html'
      ]
    ],
    ['defs', ['defs/sprite.defs.html']],
    ['symbol', ['symbol/sprite.symbol.html']],
    ['stack', ['stack/sprite.stack.html']]
  ] as const)('creates a %s sprite from single fixtures', async (mode, expected) => {
    const dest = path.join(tmpPath, mode);
    const renderers =
      mode === 'css' || mode === 'view'
        ? [
            `--${mode}-render-css`,
            `--${mode}-render-scss`,
            `--${mode}-render-less`,
            `--${mode}-render-styl`
          ]
        : [];

    await svgSprite(
      `--${mode}`,
      ...renderers,
      `--${mode}-example`,
      '-D',
      dest,
      path.join(fixtures, '*.svg')
    );

    const files = await listFiles(dest);
    const svg = files.filter((file) => file.endsWith('.svg'));

    expect(svg).toHaveLength(1);
    expect(svg[0]).toMatch(new RegExp(`^${mode}/svg/sprite\\.css(-[0-9a-f]{8})?\\.svg$`));
    expect(files.filter((file) => !file.endsWith('.svg'))).toStrictEqual([...expected].toSorted());

    const sprite = await readFile(path.join(dest, svg[0] ?? ''), 'utf8');

    expect(sprite).toContain('<svg');
    expect(sprite).toContain('weather-clear');
  });

  it('reads an external JSON configuration file', async () => {
    const dest = path.join(tmpPath, 'config');
    const configFile = path.join(tmpPath, 'config.json');

    await mkdir(tmpPath, { recursive: true });
    await writeFile(configFile, JSON.stringify({ mode: { symbol: true } }));
    await svgSprite('--config', configFile, '-D', dest, path.join(fixtures, 'weather-clear.svg'));

    const files = await listFiles(dest);

    expect(files.some((file) => file.startsWith('symbol/'))).toBe(true);
  });

  it('uses the original glob base marker for nested shape IDs', async () => {
    const assets = path.join(tmpPath, 'marker-assets');
    const dest = path.join(tmpPath, 'marker-output');

    await mkdir(path.join(assets, 'nested'), { recursive: true });
    await writeFile(
      path.join(assets, 'nested', 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
    );
    await svgSprite('--symbol', '--symbol-bust=false', '-D', dest, `${assets}/./**/*.svg`);

    const sprite = await readFile(path.join(dest, 'symbol/svg/sprite.css.svg'), 'utf8');

    expect(sprite).toContain('id="nested--icon"');

    await svgSprite(
      '--symbol',
      '--symbol-bust=false',
      '-D',
      path.join(tmpPath, 'unmarked-output'),
      `${assets}/**/*.svg`
    );
    const unmarked = await readFile(
      path.join(tmpPath, 'unmarked-output/symbol/svg/sprite.css.svg'),
      'utf8'
    );

    expect(unmarked).toContain('id="icon"');
    expect(unmarked).not.toContain('id="nested--icon"');
  });

  it('does not re-ingest the output directory on repeated recursive globs', async () => {
    const assets = path.join(tmpPath, 'loop-assets');
    const dest = path.join(assets, 'out');

    await mkdir(assets, { recursive: true });
    await writeFile(
      path.join(assets, 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
    );

    for (let iteration = 0; iteration < 2; iteration++) {
      await svgSprite('--symbol', '--symbol-bust=false', '-D', dest, `${assets}/**/*.svg`);
    }

    const sprite = await readFile(path.join(dest, 'symbol/svg/sprite.css.svg'), 'utf8');

    expect(sprite.match(/<symbol\b/g)).toHaveLength(1);
    expect(sprite).toContain('id="icon"');
  });

  it('excludes a mode destination outside the main output tree', async () => {
    const assets = path.join(tmpPath, 'external-mode-assets');
    const dest = path.join(assets, 'out');
    const modeDest = path.join(assets, 'generated');

    await mkdir(assets, { recursive: true });
    await writeFile(
      path.join(assets, 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
    );

    for (let iteration = 0; iteration < 2; iteration++) {
      await svgSprite(
        '--symbol',
        '--symbol-bust=false',
        '-D',
        dest,
        `--symbol-dest=${modeDest}`,
        `${assets}/**/*.svg`
      );
    }

    const sprite = await readFile(path.join(modeDest, 'svg/sprite.css.svg'), 'utf8');

    expect(sprite.match(/<symbol\b/g)).toHaveLength(1);
  });

  it.each(['symbol', 'generated'])('excludes %s output when dest is the cwd', async (modeDest) => {
    const directory = path.join(tmpPath, `cwd-${modeDest}`);
    const neighbor = path.join(directory, `${modeDest}-icons`);

    await mkdir(neighbor, { recursive: true });
    await writeFile(
      path.join(directory, 'icon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
    );
    await writeFile(
      path.join(neighbor, 'neighbor.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle r="5" cx="5" cy="5"/></svg>'
    );

    for (let iteration = 0; iteration < 2; iteration++) {
      await run(
        process.execPath,
        [
          cli,
          '--symbol',
          '--symbol-bust=false',
          `--symbol-dest=${modeDest}`,
          `${directory}/**/*.svg`
        ],
        { cwd: directory }
      );
    }

    const sprite = await readFile(path.join(directory, modeDest, 'svg/sprite.css.svg'), 'utf8');

    expect(sprite.match(/<symbol\b/g)).toHaveLength(2);
    expect(sprite).toContain('id="icon"');
    expect(sprite).toContain('id="neighbor"');
  });
});
