import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { escapeXml } from '../src/utils/escape-xml.ts';
import { formatSize } from '../src/utils/format-size.ts';
import { deepMerge } from '../src/utils/merge.ts';
import { TaskQueue, runPool } from '../src/utils/pool.ts';
import { isFunction, isObject, isPlainObject, isString, trimStart } from '../src/utils/guards.ts';
import {
  DEFAULT_SVG_NAMESPACE,
  XLINK_NAMESPACE,
  createSvgSelector,
  getNamespaceMap,
  renameElement,
  selectAttributes,
  selectElements
} from '../src/utils/xml.ts';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('utility modules', () => {
  describe('guards', () => {
    it('detects functions, objects, strings and plain objects', () => {
      expect(
        isFunction(
          class Example {
            readonly value = 1;
          }
        )
      ).toBe(true);
      expect(isFunction(async () => undefined)).toBe(true);
      expect(isFunction(/a/gu)).toBe(false);

      expect(isObject({})).toBe(true);
      expect(isObject(new String('value'))).toBe(true);
      expect(isObject([1, 2, 3])).toBe(true);
      expect(isObject(() => undefined)).toBe(false);
      expect(isObject(null)).toBe(false);

      expect(isString('value')).toBe(true);
      expect(isString(new String('value'))).toBe(true);
      expect(isString(false)).toBe(false);

      expect(isPlainObject({ key: 'value' })).toBe(true);
      expect(isPlainObject(Object.create(null))).toBe(true);
      expect(isPlainObject([1, 2, 3])).toBe(false);
      expect(isPlainObject(new Number(1))).toBe(false);
    });

    it('trims leading characters from strings', () => {
      expect(trimStart('  abc  ')).toBe('abc  ');
      expect(trimStart('../././../../somefile.txt', '/.')).toBe('somefile.txt');
      expect(trimStart(undefined as unknown as string)).toBe('');
      expect(trimStart(null as unknown as string, '*')).toBe('');
      expect(trimStart('', '_-_')).toBe('');
      expect(trimStart('   a lovely string   ', '')).toBe('   a lovely string   ');
    });
  });

  describe('escapeXml()', () => {
    it('escapes XML-significant characters and normalizes nullish values', () => {
      expect(escapeXml(`<tag attr="x">&'`)).toBe('&lt;tag attr=&quot;x&quot;&gt;&amp;&#39;');
      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
    });
  });

  describe('formatSize()', () => {
    it('formats byte sizes with binary units', () => {
      expect(formatSize(0)).toBe('0 Bytes');
      expect(formatSize(1024)).toBe('1 kB');
      expect(formatSize(1536)).toBe('1.5 kB');
      expect(formatSize(1024 ** 2)).toBe('1 MB');
    });
  });

  describe('deepMerge()', () => {
    it('recursively merges plain objects while replacing arrays and skipping undefined values', () => {
      expect(
        deepMerge(
          {
            nested: { stable: true, keep: 'left' },
            replaceMe: ['left'],
            keep: 'left'
          },
          {
            nested: { keep: 'right', add: 1 },
            replaceMe: ['right'],
            keep: undefined,
            extra: true
          }
        )
      ).toStrictEqual({
        nested: { stable: true, keep: 'right', add: 1 },
        replaceMe: ['right'],
        keep: 'left',
        extra: true
      });
    });
  });

  describe('runPool()', () => {
    it('preserves task order while honoring the concurrency limit', async () => {
      let active = 0;
      let peak = 0;

      const tasks = [30, 10, 0].map((timeout, index) => async () => {
        active++;
        peak = Math.max(peak, active);
        await delay(timeout);
        active--;
        return `task-${index}`;
      });

      await expect(runPool(tasks, 2)).resolves.toStrictEqual(['task-0', 'task-1', 'task-2']);
      expect(peak).toBeLessThanOrEqual(2);
    });
  });

  describe('TaskQueue', () => {
    it('runs queued tasks up to its limit and eventually becomes idle', async () => {
      const queue = new TaskQueue(2);
      let active = 0;
      let peak = 0;
      const completed: string[] = [];

      for (const [name, timeout] of [
        ['first', 20],
        ['second', 10],
        ['third', 0]
      ] as const) {
        queue.add(async () => {
          active++;
          peak = Math.max(peak, active);
          await delay(timeout);
          completed.push(name);
          active--;
        });
      }

      await queue.idle();

      expect(peak).toBe(2);
      expect(queue.active).toBe(0);
      expect(completed.toSorted()).toStrictEqual(['first', 'second', 'third']);
    });

    it('rejects with the first task error and can be reused afterwards', async () => {
      const queue = new TaskQueue(1);
      const error = new Error('boom');
      const completed: string[] = [];

      queue.add(async () => {
        completed.push('before-error');
      });
      queue.add(async () => {
        throw error;
      });

      await expect(queue.idle()).rejects.toBe(error);

      queue.add(async () => {
        completed.push('after-error');
      });
      await expect(queue.idle()).resolves.toBeUndefined();
      expect(completed).toStrictEqual(['before-error', 'after-error']);
    });
  });

  describe('xml helpers', () => {
    it('selects SVG elements and attributes with registered namespaces', () => {
      const document = new DOMParser().parseFromString(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g id="shape"><use xlink:href="#shape"/></g></svg>',
        'text/xml'
      );
      const select = createSvgSelector();
      const [group] = selectElements(select, '//svg:g', document);
      const [use] = selectElements(select, '//svg:use', document);
      const [href] = selectAttributes(select, '//svg:use/@xlink:href', document);

      if (!group || !use || !href) {
        throw new Error('Expected SVG nodes to be selected');
      }

      expect(group.tagName).toBe('g');
      expect(use.tagName).toBe('use');
      expect(href.value).toBe('#shape');
      if (!document.documentElement) {
        throw new Error('Expected an SVG document element');
      }

      const namespaceMap = getNamespaceMap(document.documentElement);

      expect(namespaceMap['']).toBe(DEFAULT_SVG_NAMESPACE);
      expect(namespaceMap['xlink']).toBe(XLINK_NAMESPACE);

      renameElement(group, 'symbol');
      expect(group.tagName).toBe('symbol');
      expect(group.nodeName).toBe('symbol');
    });
  });
});
