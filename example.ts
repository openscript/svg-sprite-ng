import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { globSync } from 'tinyglobby';
import { SvgSpriter } from './src/index.ts';

const cwd = path.join(import.meta.dirname, 'test/fixture/svg/single');
const dest = path.join(import.meta.dirname, 'tmp');
const files = globSync('**/weather*.svg', { cwd });

const spriter = new SvgSpriter({
  dest,
  log: 'debug',
  svg: {
    doctypeDeclaration: false,
    xmlDeclaration: false
  },
  shape: {
    transform: [
      {
        svgo: {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeUnknownsAndDefaults: {
                    keepRoleAttr: true
                  }
                }
              }
            },
            'cleanupListOfValues',
            'convertStyleToAttrs',
            'sortAttrs',
            {
              name: 'removeAttrs',
              params: {
                attrs: ['clip-rule', 'data-name']
              }
            }
          ]
        }
      }
    ]
  }
});

for (const file of files) {
  const filePath = path.join(cwd, file);

  spriter.add(path.resolve(filePath), file, await readFile(filePath, 'utf8'));
}

const { result } = await spriter.compile({
  css: {
    sprite: 'svg/sprite.vertical.svg',
    layout: 'vertical',
    dimensions: true,
    render: {
      css: true,
      scss: true
    }
  }
});

const css = result.css;

if (css && !Array.isArray(css)) {
  for (const file of Object.values(css)) {
    if (file) {
      await mkdir(path.dirname(file.path), { recursive: true });
      await writeFile(file.path, file.contents);
    }
  }
}
