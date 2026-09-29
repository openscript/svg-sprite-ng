import os from 'node:os';
import type { ViteUserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

const THREADS = Math.max(os.cpus().length - 2, 2);

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    globalSetup: ['test/vitest/setup.global.ts'],
    setupFiles: ['test/vitest/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    clearMocks: true,
    mockReset: true,
    maxWorkers: THREADS,
    coverage: {
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
      include: ['src/**/*.ts']
    }
  }
});

export default config;
