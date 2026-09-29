import type { Element } from '@xmldom/xmldom';
import type { SpriteFile } from '../file.ts';
import type { SvgShape } from '../shape.ts';
import { SvgSprite } from '../sprite.ts';
import type { MustacheData, SpriterContext } from '../types.ts';
import type { MergedModeConfig } from './base.ts';
import { SvgSpriteStandalone } from './standalone.ts';

/** `<defs>` sprite */
export class SvgSpriteDefs extends SvgSpriteStandalone {
  constructor(spriter: SpriterContext, config: MergedModeConfig, data: MustacheData, key?: string) {
    super(spriter, config, data, key, 'defs');
  }

  protected override shapeTransform(shape: SvgShape): (element: Element) => void {
    const dimensionAttributes = shape.config.dimension.attributes;

    return (element) => {
      element.setAttribute('id', shape.id);

      if (!dimensionAttributes) {
        element.removeAttribute('width');
        element.removeAttribute('height');
      }
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

    svg.add('<defs>');
    svg.add(this.data.shapes.map((shape) => shape.svg));
    svg.add('</defs>');

    return svg.toFile(this.spriter.config.dest, this.addCacheBusting(svg));
  }
}
