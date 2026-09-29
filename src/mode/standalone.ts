import { format } from 'node:util';
import type { Element } from '@xmldom/xmldom';
import type { SpriteFile } from '../file.ts';
import type { SvgShape } from '../shape.ts';
import type {
  ModeFiles,
  MustacheData,
  SelectorPart,
  SpriteType,
  SpriterContext
} from '../types.ts';
import { isString } from '../utils/guards.ts';
import type { MergedModeConfig } from './base.ts';
import { SvgSpriteBase, withLazySvg } from './base.ts';

/** Base class for non-css sprites */
export abstract class SvgSpriteStandalone extends SvgSpriteBase {
  /** Dimension selector template */
  protected dimensionTemplate: string;

  constructor(
    spriter: SpriterContext,
    config: MergedModeConfig,
    data: MustacheData,
    key: string | undefined,
    mode: SpriteType
  ) {
    super(spriter, config, data, key, mode);

    // Prepare the dimension suffix
    let dimensions = isString(config.dimensions) ? config.dimensions.trim() : '-dims';

    if (dimensions) {
      dimensions = /%s/.test(dimensions.split('%%').join(''))
        ? format(dimensions, this.config.prefix)
        : this.config.prefix + dimensions;
    }

    this.dimensionTemplate = dimensions;
    this.config.dimensions = dimensions;
    this.data.inline = Boolean(config.inline);
  }

  /** The DOM transformation that turns a shape into its sprite representation */
  protected abstract shapeTransform(shape: SvgShape): (element: Element) => void;

  /** Build the sprite SVG file */
  protected abstract buildSvg(xmlDeclaration: string, doctypeDeclaration: string): SpriteFile;

  protected dimensionSelectors(shape: SvgShape): SelectorPart[] {
    const template = this.dimensionTemplate;

    return shape.state
      ? [
          {
            expression: `${format(template, shape.base)}:${shape.state}`,
            raw: `${format(template, shape.base)}:${shape.state}`,
            first: true,
            last: false
          },
          {
            expression: format(template, `${shape.base}\\:${shape.state}`),
            raw: format(template, `${shape.base}:${shape.state}`),
            first: false,
            last: true
          }
        ]
      : [
          {
            expression: format(template, shape.base),
            raw: format(template, shape.base),
            first: true,
            last: true
          }
        ];
  }

  async layout(files: ModeFiles): Promise<MustacheData> {
    // Refine the shape data
    let xmlDeclaration = '';
    let doctypeDeclaration = '';

    for (const [index, shape] of this.spriter.shapes.entries()) {
      // Skip non-master shapes
      if (shape.master) {
        continue;
      }

      xmlDeclaration ||= shape.xmlDeclaration;
      doctypeDeclaration ||= shape.doctypeDeclaration;

      const existing = this.data.shapes[index];

      if (existing) {
        const transform = this.shapeTransform(shape);

        this.data.shapes[index] = withLazySvg(
          { ...existing, selector: { dimensions: this.dimensionSelectors(shape) } },
          () => shape.getSVG(true, transform)
        );
      }
    }

    // Remove all non-master shapes
    this.data.shapes = this.data.shapes.filter((shape) => !shape.master);

    // Build the sprite SVG file
    files.sprite = this.buildSvg(xmlDeclaration, doctypeDeclaration);
    this.spriter.verbose('Created «%s» SVG sprite file («%s» mode)', this.key, this.mode);

    // Build the configured CSS resources and the HTML example
    await this.buildCssResources(files);

    return this.buildHtmlExample(files);
  }
}
