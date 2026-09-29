import type { Attr, Document, Element, Node } from '@xmldom/xmldom';
import * as xpath from 'xpath';

export const DEFAULT_SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

export const ELEMENT_NODE = 1;

type Selector = (expression: string, node: Document | Element) => Node[];

/** Create a typed XPath selector for nodes that resolves the `svg:` and `xlink:` prefixes. */
export function createSvgSelector(): Selector {
  const select = xpath.useNamespaces({ svg: DEFAULT_SVG_NAMESPACE, xlink: XLINK_NAMESPACE });

  return (expression, node) => {
    const result: unknown = select(expression, node as never);
    return Array.isArray(result) ? (result as Node[]) : [];
  };
}

export function selectElements(select: Selector, expression: string, node: Document): Element[] {
  return select(expression, node) as Element[];
}

export function selectAttributes(select: Selector, expression: string, node: Document): Attr[] {
  return select(expression, node) as Attr[];
}

/** Internal namespace map that xmldom keeps on every element. */
export function getNamespaceMap(element: Element): Record<string, string> {
  return (element as unknown as { _nsMap?: Record<string, string> })._nsMap ?? {};
}

/** Rename an element in place (xmldom keeps the name in three writable properties). */
export function renameElement(element: Element, name: string): void {
  const writable = element as unknown as { nodeName: string; tagName: string; localName: string };
  writable.nodeName = name;
  writable.tagName = name;
  writable.localName = name;
}
