import path from 'node:path';
import { globSync } from 'tinyglobby';
import { paths } from './constants.ts';

export interface TestConfig {
  name: string;
  namespace: string;
  files: string[];
  cwd: string;
}

const cwdWeather = path.join(paths.fixtures, 'svg/single');
const cwdWithoutDims = path.join(paths.fixtures, 'svg/special/without-dims');

export const constants: { DEFAULT: TestConfig; WITHOUT_DIMS: TestConfig } = {
  DEFAULT: {
    name: 'weather',
    namespace: '',
    files: globSync('**/weather*.svg', { cwd: cwdWeather }).toSorted(),
    cwd: cwdWeather
  },
  WITHOUT_DIMS: {
    name: 'without-dims',
    namespace: '-without-dims',
    files: globSync('**/*.svg', { cwd: cwdWithoutDims }).toSorted(),
    cwd: cwdWithoutDims
  }
};

export const testConfigs: TestConfig[] = [constants.DEFAULT, constants.WITHOUT_DIMS];
