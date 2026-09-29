# svg-sprite

This file is part of the documentation of *svg-sprite* — a free low-level Node.js module that **takes a bunch of SVG files**, optimizes them and creates **SVG sprites** of several types. The package is [hosted on GitHub](https://github.com/svg-sprite/svg-sprite).


## Standard API

*svg-sprite* exposes four main entry points:

* [`new SvgSpriter([ config ])`](#svgspriter-config-) — The spriter constructor
* [`SvgSpriter.add(file [, name, svg ])`](#svgspriteraddfile--name-svg-) — Registering source SVG files
* [`SvgSpriter.compile([ config ])`](#svgspritercompile-config-) — Triggering sprite compilation
* [`SvgSpriter.getShapes(dest)`](#svgspritergetshapesdest) — Accessing the intermediate SVG resources

The package is **ESM-only**, requires **Node.js >= 22.12**, and ships TypeScript types such as `SpriterConfig`, `ModeMap`, `SpriteResult`, `SpriteFile`, and `Logger`.

### Usage example

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { SvgSpriter } from 'svg-sprite';

async function writeFiles(files) {
  if (!files) {
    return;
  }

  for (const file of Object.values(files)) {
    if (!file) {
      continue;
    }

    if (Array.isArray(file)) {
      await writeFiles(file);
    } else if (typeof file === 'object' && 'path' in file && 'contents' in file) {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, file.contents);
    } else if (typeof file === 'object') {
      await writeFiles(file);
    }
  }
}

// 1. Create and configure a spriter instance
const spriter = new SvgSpriter({
  dest: 'out',
  mode: {
    css: {
      render: {
        css: true
      }
    }
  }
});

// 2. Add some SVG files to process
spriter.add(
  path.resolve('assets/example-1.svg'),
  'example-1.svg',
  await fs.readFile('assets/example-1.svg', 'utf8')
);

/* ... */

spriter.add(
  path.resolve('assets/example-x.svg'),
  'example-x.svg',
  await fs.readFile('assets/example-x.svg', 'utf8')
);

// 3. Trigger compilation and write the generated files
const { result } = await spriter.compile();
await writeFiles(result.css);
```

#### SvgSpriter([ config ])

**Constructor** — This is the entry point for the public API.

##### Arguments

1. **config** `{Object}` *(default: `{}`)* — [Main configuration](configuration.md) for the spriting process. As all configuration properties are optional, you may provide an empty object here or omit the argument altogether (no output files will be created then, but the [added SVG files](#svgspriteraddfile--name-svg-) will still be optimized). The `mode` configuration may also be specified when calling [`.compile()`](#svgspritercompile-config-).

Create the spriter with a named export:

```js
import { SvgSpriter } from 'svg-sprite';

const spriter = new SvgSpriter(config);
```

There is no CommonJS `require('svg-sprite')` factory and no default export.

#### SvgSpriter.add(file [, name, svg ])

**Registration of an SVG file** — Before compilation, you need to register one or more SVG files for processing. As *svg-sprite* doesn't read files from disk itself, you have to pass both the path and the file contents explicitly.

The `.add()` method accepts either:

* an absolute file path plus `name` and `svg` arguments, or
* a file-like object with `{ path, base, contents }`.

File objects from other tools can be passed directly when they provide those properties; *svg-sprite* does not require a particular file-object library.

The spriter **optimizes SVG files as soon as you register them**, not only when you later [compile the sprite](#svgspritercompile-config-). This makes it possible to call `.compile()` multiple times with different mode configurations without repeating the optimization step.

##### Arguments

1. **file** `{String|Object}` — Absolute path to the SVG file or a file-like object with `path`, `base`, and `contents` properties (the following arguments are ignored then).
2. **name** `{String}` *(ignored with file objects)* — The local part of the file path, possibly including subdirectories which will get traversed to CSS selectors using the `shape.id.separator` [configuration option](configuration.md#shape-ids). When `name` is empty, *svg-sprite* uses the basename of the `file` argument.
3. **svg** `{String|Uint8Array}` *(ignored with file objects)* — SVG file contents.

##### Example using [tinyglobby](https://github.com/SuperchupuDev/tinyglobby)

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'tinyglobby';
import { SvgSpriter } from 'svg-sprite';

const spriter = new SvgSpriter({
  dest: 'out',
  mode: {
    css: {
      render: {
        css: true
      }
    }
  }
});
const cwd = path.resolve('assets');
const files = await glob('**/*.svg', { cwd });

for (const file of files) {
  const filePath = path.join(cwd, file);

  spriter.add({
    path: filePath,
    base: cwd,
    contents: await fs.readFile(filePath)
  });
}

const { result } = await spriter.compile();
console.log(result.css?.sprite?.relative);
```

#### SvgSpriter.compile([ config ])

**Sprite compilation** — Triggers an asynchronous sprite compilation process. You may pass an optional [output mode configuration](configuration.md#output-modes) object in order to override the modes configured on the spriter instance for that run. You may call `.compile()` multiple times, allowing several different sprites to be generated by the same spriter instance.

##### Arguments

1. **config** `{Object}` *(optional)* — Configuration object setting the [output mode parameters](configuration.md#output-modes) for a single compilation run. If omitted, the `mode` property of the [main configuration](configuration.md) used for the [constructor](#svgspriter-config-) will be used.

##### Returns

A `Promise` resolving to an object with these properties:

* **result** `{Object}` — Generated resources ([see below](#compilation-example))
* **data** `{Object}` — Templating variables passed to Mustache for rendering the resources (see [sprite & shape variables](templating.md#sprite--shape-variables) for details)

##### Throws

**error** `{Error}` — Error message in case the compilation fails

##### Compilation example

Depending on the selected mode and render configuration, a single compilation run may generate several resources:

```js
const { result } = await spriter.compile({
  css: {
    render: {
      scss: true
    },
    example: true
  }
});

console.log(result);
```

The output looks roughly like this (shortened for brevity):

```js
{
  css: {
    sprite: <SpriteFile "css/svg/sprite.css.svg">,
    scss: <SpriteFile "css/sprite.scss">,
    example: <SpriteFile "css/sprite.css.html">
  }
}
```

For each configured output mode (`css` in the example), the `result` object holds an item containing the resources generated for this mode. There is always a `sprite` resource and possibly an `example` resource for the demo HTML document. For the [css and view](configuration.md#css--view-mode) output modes, there are additional items named after the configured [rendering configurations](configuration.md#rendering-configurations) (`scss` in the example).

The generated resources are returned as `SpriteFile` instances. They expose a `path`, `base`, `contents` (`Buffer`) and `relative` property. If downstream tooling expects Vinyl objects, wrap these files yourself before handing them off.

There is no separate `compileAsync()` method anymore — `.compile()` already returns a promise.

#### SvgSpriter.getShapes(dest)

**Accessing the intermediate SVG resources** — Sometimes you may want the transformed / optimized SVG files that *svg-sprite* produces before they are combined into a sprite. Since shape processing is asynchronous, accessing them is asynchronous as well.

##### Arguments

1. **dest** `{String}` — Base directory for the SVG files in case they will be written to disk.

##### Returns

A `Promise<SpriteFile[]>` resolving to the intermediate SVG files.

##### Shape access example

```js
import fs from 'node:fs/promises';
import path from 'node:path';

const shapes = await spriter.getShapes(path.resolve('tmp/svg'));

for (const file of shapes) {
  await fs.mkdir(path.dirname(file.path), { recursive: true });
  await fs.writeFile(file.path, file.contents);
}
```
