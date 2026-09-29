import path from 'node:path';
import { afterAll, beforeAll, expect } from 'vitest';
import { ConsoleLogger } from '../../src/logger.ts';
import { closeBrowser, launchBrowser } from '../helpers/capture-browser.ts';
import { compareHtml2Png } from '../helpers/compare-html-2-png.ts';
import { compareSvg2Png } from '../helpers/compare-svg-2-png.ts';

expect.extend({
  async toBeVisuallyEqualTo(receivedSVGPath: string, expectedPNGPath: string) {
    const resultPNGPath = path.join(
      path.dirname(receivedSVGPath),
      path.basename(receivedSVGPath).replace('.svg', '.svg.png')
    );
    const { isEqual, matched } = await compareSvg2Png(
      receivedSVGPath,
      resultPNGPath,
      expectedPNGPath
    );
    const expected = path.basename(receivedSVGPath);
    const received = path.basename(expectedPNGPath);

    return {
      pass: isEqual,
      message: () =>
        isEqual
          ? `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${this.utils.printReceived(received)}`
          : `${this.utils.printReceived('Difference:')} ${expected} -> ${received}\nExpected: ${this.utils.printExpected('no difference')}\nReceived: ${this.utils.printReceived(matched)} mismatches`
    };
  },

  async toBeVisuallyCorrectAsHTMLTo(receivedHTMLPath: string, expectedPNGPath: string) {
    const { isEqual, matched } = await compareHtml2Png(receivedHTMLPath, expectedPNGPath);
    const expected = path.basename(receivedHTMLPath);
    const received = path.basename(expectedPNGPath);

    return {
      pass: isEqual,
      message: () =>
        isEqual
          ? `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${this.utils.printReceived(received)}`
          : `${this.utils.printReceived('Difference:')} ${expected} -> ${received}\nExpected: ${this.utils.printExpected('no difference')}\nReceived: ${this.utils.printReceived(matched)} mismatches`
    };
  },
  toBeDefaultLogger(received: unknown) {
    const pass = received instanceof ConsoleLogger;

    return {
      pass,
      message: () =>
        pass
          ? 'Expected: not the default console logger'
          : `Expected: the default console logger\nReceived: ${this.utils.printReceived(received)}`
    };
  }
});

beforeAll(launchBrowser);
afterAll(closeBrowser);
