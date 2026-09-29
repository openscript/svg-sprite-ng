import type { Element } from '@xmldom/xmldom';
import type { SpriteFile } from '../file.ts';
import type { SvgShape } from '../shape.ts';
import { SvgSprite } from '../sprite.ts';
import type { MustacheData, SpriterContext } from '../types.ts';
import { renameElement } from '../utils/xml.ts';
import type { MergedModeConfig } from './base.ts';
import { SvgSpriteStandalone } from './standalone.ts';

/** Attributes that are valid on a `<symbol>` element */
const symbolAttributes: ReadonlySet<string> = new Set([
  'alignment-baseline',
  'aria-labelledby',
  'baseline-shift',
  'class',
  'clip',
  'clip-path',
  'clip-rule',
  'color',
  'color-interpolation',
  'color-interpolation-filters',
  'color-profile',
  'color-rendering',
  'cursor',
  'direction',
  'display',
  'dominant-baseline',
  'enable-background',
  'externalResourcesRequired',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'glyph-orientation-horizontal',
  'glyph-orientation-vertical',
  'id',
  'image-rendering',
  'kerning',
  'letter-spacing',
  'lighting-color',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'onactivate',
  'onclick',
  'onfocusin',
  'onfocusout',
  'onload',
  'onmousedown',
  'onmousemove',
  'onmouseout',
  'onmouseover',
  'onmouseup',
  'opacity',
  'overflow',
  'pointer-events',
  'preserveAspectRatio',
  'shape-rendering',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'style',
  'text-anchor',
  'text-decoration',
  'text-rendering',
  'unicode-bidi',
  'viewBox',
  'visibility',
  'word-spacing',
  'writing-mode',
  'xml:base',
  'xml:lang',
  'xml:space'
]);

/** `<symbol>` sprite */
export class SvgSpriteSymbol extends SvgSpriteStandalone {
  constructor(spriter: SpriterContext, config: MergedModeConfig, data: MustacheData, key?: string) {
    super(spriter, config, data, key, 'symbol');
  }

  protected override shapeTransform(shape: SvgShape): (element: Element) => void {
    return (element) => {
      renameElement(element, 'symbol');

      // oxlint-disable-next-line unicorn/no-useless-spread -- the attribute list is live and mutated below
      for (const { name } of [...element.attributes]) {
        if (!symbolAttributes.has(name)) {
          element.removeAttribute(name);
        }
      }

      element.setAttribute('id', shape.id);
    };
  }

  protected override buildSvg(xmlDeclaration: string, doctypeDeclaration: string): SpriteFile {
    const { inline } = this.config;
    const defaultRootAttributes = { ...this.config.svg.rootAttributes };
    const rootAttributes = inline
      ? {
          ...defaultRootAttributes,
          ...(this.config.svg.dimensionAttributes ? { width: 0, height: 0 } : {}),
          style: 'position:absolute'
        }
      : defaultRootAttributes;
    const xml = inline ? '' : this.declaration(this.config.svg.xmlDeclaration, xmlDeclaration);
    const doctype = inline
      ? ''
      : this.declaration(this.config.svg.doctypeDeclaration, doctypeDeclaration);

    const svg = new SvgSprite(xml, doctype, rootAttributes, !inline, this.config.svg.transform);

    svg.add(this.data.shapes.map((shape) => shape.svg));

    return svg.toFile(this.spriter.config.dest, this.addCacheBusting(svg));
  }
}
