# svg-sprite

This file is part of the documentation of *svg-sprite* — a free low-level Node.js module that **takes a bunch of SVG files**, optimizes them and creates **SVG sprites** of several types. The package is [hosted on GitHub](https://github.com/svg-sprite/svg-sprite).


## Grunt & Gulp wrappers

This document compares the use of *svg-sprite* via its [standard API](api.md) with wrappers like the ones for Grunt and Gulp. The examples are equivalent and simplified for clarity.

## Standard API

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

const spriter = new SvgSpriter(config);

spriter.add('assets/svg-1.svg', null, await fs.readFile('assets/svg-1.svg', 'utf8'));
spriter.add('assets/svg-2.svg', null, await fs.readFile('assets/svg-2.svg', 'utf8'));

const { result } = await spriter.compile();
await writeFiles(result);
```

## Grunt task (using [grunt-svg-sprite](https://github.com/svg-sprite/grunt-svg-sprite))

```js
// svg-sprite Grunt task
grunt.initConfig({
  svg_sprite: {
    minimal: {
      src: ['assets/**/*.svg'],
      dest: 'out',
      options: config
    }
  }
});
```

## Gulp task (using [gulp-svg-sprite](https://github.com/svg-sprite/gulp-svg-sprite))

```js
// svg-sprite Gulp task
gulp.src('assets/*.svg')
  .pipe(svgSprite(config))
  .pipe(gulp.dest('out'));
```

The core library no longer depends on `vinyl`, but it still accepts Vinyl-like inputs (`{ path, base, contents }`). Wrappers such as `gulp-svg-sprite` can therefore keep using Vinyl at their boundaries; if you call the standard API directly and need Vinyl outputs for downstream plugins, wrap the returned `SpriteFile` objects yourself.
