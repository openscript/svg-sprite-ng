import { Buffer } from 'node:buffer';
import { SpriteFile } from './file.ts';
import type { SvgTransformer } from './types.ts';
import { escapeXml } from './utils/escape-xml.ts';
import { DEFAULT_SVG_NAMESPACE, XLINK_NAMESPACE } from './utils/xml.ts';

/** A sprite SVG document being assembled. */
export class SvgSprite {
  readonly xmlDeclaration: string;
  readonly doctypeDeclaration: string;
  readonly rootAttributes: Record<string, string | number>;
  readonly transform: readonly SvgTransformer[];
  readonly content: string[] = [];
  #serialized: string | null = null;

  /**
   * @param xmlDeclaration      XML declaration
   * @param doctypeDeclaration  Doctype declaration
   * @param rootAttributes      Root attributes
   * @param addSVGNamespaces    Add default SVG namespaces
   * @param transform           Post-processing transform callbacks
   */
  constructor(
    xmlDeclaration: string | undefined,
    doctypeDeclaration: string | undefined,
    rootAttributes: Readonly<Record<string, string | number>> | undefined,
    addSVGNamespaces: boolean,
    transform: readonly SvgTransformer[] = []
  ) {
    this.xmlDeclaration = xmlDeclaration || '';
    this.doctypeDeclaration = doctypeDeclaration || '';
    this.rootAttributes = { ...rootAttributes };
    this.transform = transform;

    if (addSVGNamespaces) {
      this.rootAttributes['xmlns'] = DEFAULT_SVG_NAMESPACE;
      this.rootAttributes['xmlns:xlink'] = XLINK_NAMESPACE;
    }
  }

  /** Add a content string or a list of content strings */
  add(content: string | readonly string[]): void {
    if (typeof content === 'string') {
      this.content.push(content);
    } else {
      this.content.push(...content);
    }

    this.#serialized = null;
  }

  /** Serialize the SVG sprite */
  toString(): string {
    if (this.#serialized !== null) {
      return this.#serialized;
    }

    let svg = `${this.xmlDeclaration}${this.doctypeDeclaration}<svg`;

    for (const [attr, value] of Object.entries(this.rootAttributes)) {
      svg += ` ${attr}="${escapeXml(value)}"`;
    }

    svg += `>${this.content.join('')}</svg>`;

    // Apply post-processing transformations
    for (const transform of this.transform) {
      svg = transform(svg) || '';
    }

    this.#serialized = svg;

    return svg;
  }

  toFile(base: string, path: string): SpriteFile {
    return new SpriteFile({ base, path, contents: Buffer.from(this.toString()) });
  }
}
