import type { SpriteFile } from '../file.ts';
import type { SvgShape } from '../shape.ts';
import { SvgSprite } from '../sprite.ts';
import type { MustacheData, SpriterContext } from '../types.ts';
import type { MergedModeConfig } from './base.ts';
import { SvgSpriteCss } from './css.ts';

/** View sprite */
export class SvgSpriteView extends SvgSpriteCss {
  constructor(spriter: SpriterContext, config: MergedModeConfig, data: MustacheData, key?: string) {
    super(spriter, config, data, key, 'view');
  }

  protected override refineRootAttributes(
    shape: SvgShape,
    rootAttributes: Record<string, string | number>
  ): Record<string, string | number> {
    // If it's the master shape of multiple displaced copies
    if (this.displaceable) {
      if (shape.master) {
        delete rootAttributes['id'];
        rootAttributes['xlink:href'] = `#${shape.master.id}-`;
      } else {
        rootAttributes['id'] += '-';
      }

      // Else: Remove the ID attribute
    } else {
      delete rootAttributes['id'];
    }

    return rootAttributes;
  }

  protected override buildSvg(xmlDeclaration: string, doctypeDeclaration: string): SpriteFile {
    const rootAttributes: Record<string, string | number> = {
      ...this.config.svg.rootAttributes,
      ...(this.config.svg.dimensionAttributes
        ? { width: this.spriteWidth, height: this.spriteHeight }
        : {}),
      viewBox: `0 0 ${this.spriteWidth} ${this.spriteHeight}`
    };
    const xml = this.declaration(this.config.svg.xmlDeclaration, xmlDeclaration);
    const doctype = this.declaration(this.config.svg.doctypeDeclaration, doctypeDeclaration);
    const svg = new SvgSprite(xml, doctype, rootAttributes, true, this.config.svg.transform);

    for (const shape of this.data.shapes) {
      const viewBox = [
        -shape.position!.absolute.x,
        -shape.position!.absolute.y,
        shape.width.outer,
        shape.height.outer
      ];

      svg.add(`<view id="${shape.name}" viewBox="${viewBox.join(' ')}"/>`);
      svg.add(shape.svg);
    }

    return svg.toFile(this.spriter.config.dest, this.addCacheBusting(svg));
  }
}
