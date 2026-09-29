import type { Element } from '@xmldom/xmldom';
import type { SpriteFile } from '../file.ts';
import type { SvgShape } from '../shape.ts';
import { SvgSprite } from '../sprite.ts';
import type { MustacheData, SpriterContext } from '../types.ts';
import type { MergedModeConfig } from './base.ts';
import { SvgSpriteStandalone } from './standalone.ts';

/** SVG stack */
export class SvgSpriteStack extends SvgSpriteStandalone {
  /** Maximum shape dimensions */
  readonly maxDimensions: { width: number; height: number };

  constructor(spriter: SpriterContext, config: MergedModeConfig, data: MustacheData, key?: string) {
    super(spriter, config, data, key, 'stack');

    this.maxDimensions = { width: 0, height: 0 };

    for (const shape of this.data.shapes) {
      this.maxDimensions.width = Math.max(this.maxDimensions.width, shape.width.outer);
      this.maxDimensions.height = Math.max(this.maxDimensions.height, shape.height.outer);
    }
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
    const rootAttributes: Record<string, string | number> = { ...this.config.svg.rootAttributes };

    if (this.config.rootviewbox) {
      rootAttributes['viewBox'] = `0 0 ${this.maxDimensions.width} ${this.maxDimensions.height}`;
    }

    const xml = this.declaration(this.config.svg.xmlDeclaration, xmlDeclaration);
    const doctype = this.declaration(this.config.svg.doctypeDeclaration, doctypeDeclaration);

    const svg = new SvgSprite(xml, doctype, rootAttributes, true, this.config.svg.transform);

    svg.add('<style>:root>svg{display:none}:root>svg:target{display:block}</style>');
    svg.add(this.data.shapes.map((shape) => shape.svg));

    return svg.toFile(this.spriter.config.dest, this.addCacheBusting(svg));
  }
}
