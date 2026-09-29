import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'tinyglobby';
import { SvgSpriter } from '../../../src/index.ts';
import { addFixtureFiles, addRelativeFixtureFiles } from '../../helpers/add-files.ts';
import { paths } from '../../helpers/constants.ts';

const cwdWeather = path.join(paths.fixtures, 'svg/single');
const weather = globSync('**/weather*.svg', { cwd: cwdWeather }).toSorted();

describe('svg-sprite: with no arguments', () => {
  it('with no SVG files has an empty result', async () => {
    expect.assertions(6);

    const spriter = new SvgSpriter({
      log: false,
      shape: {
        dest: 'svg'
      }
    });
    const { result, data } = await spriter.compile();

    expect(result).toBeInstanceOf(Object);
    expect(result).toHaveProperty('shapes');
    expect(result.shapes).toBeInstanceOf(Array);
    expect(result.shapes).toHaveLength(0);
    expect(data).toBeInstanceOf(Object);
    expect(data).toStrictEqual({});
  });

  it(`with ${weather.length} SVG files returns ${weather.length} optimized shapes`, async () => {
    expect.assertions(6);

    const spriter = new SvgSpriter({
      log: false,
      shape: {
        dest: 'svg'
      }
    });

    addFixtureFiles(spriter, weather, cwdWeather);
    const { result, data } = await spriter.compile();

    expect(result).toBeInstanceOf(Object);
    expect(result).toHaveProperty('shapes');
    expect(result.shapes).toBeInstanceOf(Array);
    expect(result.shapes).toHaveLength(weather.length);
    expect(data).toBeInstanceOf(Object);
    expect(data).toStrictEqual({});
  });

  it(`with ${weather.length} SVG files with relative paths returns ${weather.length} optimized shapes`, async () => {
    expect.assertions(6);

    const spriter = new SvgSpriter({
      log: false,
      shape: {
        dest: 'svg'
      }
    });

    addRelativeFixtureFiles(spriter, weather, cwdWeather);
    const { result, data } = await spriter.compile();

    expect(result).toBeInstanceOf(Object);
    expect(result).toHaveProperty('shapes');
    expect(result.shapes).toBeInstanceOf(Array);
    expect(result.shapes).toHaveLength(weather.length);
    expect(data).toBeInstanceOf(Object);
    expect(data).toStrictEqual({});
  });
});
