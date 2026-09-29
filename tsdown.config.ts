import { defineConfig } from 'tsdown';
import type { UserConfig } from 'tsdown';

const config: UserConfig[] = defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: 'esm',
    fixedExtension: false,
    platform: 'node',
    target: 'node22',
    dts: true,
    clean: true,
    sourcemap: true,
    copy: [{ from: 'tmpl', to: 'dist' }]
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: 'esm',
    fixedExtension: false,
    platform: 'node',
    target: 'node22',
    dts: false,
    clean: false,
    banner: '#!/usr/bin/env node',
    copy: [{ from: 'src/cli/options.yaml', to: 'dist' }]
  }
]);

export default config;
