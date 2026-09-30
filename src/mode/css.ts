import type { Element } from '@xmldom/xmldom';
import { format } from 'node:util';
import type { SpriteFile } from '../file.ts';
import type { SvgShape } from '../shape.ts';
import { SvgSprite } from '../sprite.ts';
import type {
  ModeFiles,
  MustacheData,
  SelectorPart,
  ShapeData,
  SpriteType,
  SpriterContext
} from '../types.ts';
import type { MergedModeConfig } from './base.ts';
import { SvgSpriteBase, withLazySvg } from './base.ts';
import { SvgSpriteCssPacker } from './css/packer.ts';

type RootAttributes = Record<string, string | number>;

const RELATIVE_SUFFIX_FIRST = 1;
const RELATIVE_SUFFIX_LAST = 2;

/** CSS sprite */
export class SvgSpriteCss extends SvgSpriteBase {
  /** Whether displaced shape copies are accepted */
  protected readonly displaceable: boolean;
  readonly #precision: number | null;
  spriteWidth = 0;
  spriteHeight = 0;

  constructor(
    spriter: SpriterContext,
    config: MergedModeConfig,
    data: MustacheData,
    key?: string,
    mode: SpriteType = 'css'
  ) {
    super(spriter, config, data, key, mode, 'css');

    // Prepare the dimension suffix
    if (this.config.dimensions && this.config.dimensions !== true) {
      this.config.dimensions = /%s/.test(this.config.dimensions.split('%%').join(''))
        ? format(this.config.dimensions, this.config.prefix)
        : this.config.prefix + this.config.dimensions;
    }

    // Determine the mixin mode and name
    let mixin: string | null = null;

    if (typeof this.mixinOption === 'string') {
      mixin = this.mixinOption.trim().length > 0 ? this.mixinOption.trim() : null;
    } else if (typeof this.mixinOption === 'boolean') {
      mixin = this.config.common;
    }

    this.config.mixin = mixin;

    // Refine the base data
    this.data = {
      ...this.data,
      hasCommon: Boolean(this.config.common),
      common: this.config.common,
      commonName: this.config.common || 'svg-common',
      hasMixin: Boolean(mixin),
      mixinName: mixin,
      includeDimensions: Boolean(this.config.dimensions),
      spriteWidth: 0,
      spriteHeight: 0
    };

    this.displaceable = ['vertical', 'horizontal'].includes(this.config.layout);
    this.#precision = this.config.svg.precision >= 0 ? 10 ** this.config.svg.precision : null;
  }

  /** Attributes to add to a shape's root element (overridden by the view mode) */
  protected refineRootAttributes(shape: SvgShape, rootAttributes: RootAttributes): RootAttributes {
    void shape;
    return rootAttributes;
  }

  override async layout(files: ModeFiles): Promise<MustacheData> {
    const config = this.layoutShapes();

    files.sprite = this.buildSvg(config.xmlDeclaration, config.doctypeDeclaration);
    this.spriter.verbose('Created «%s» SVG sprite file («%s» mode)', this.key, this.mode);

    await this.buildCssResources(files);

    return this.buildHtmlExample(files);
  }

  protected layoutShapes(): { xmlDeclaration: string; doctypeDeclaration: string } {
    const { shapes } = this.spriter;

    // Build a map of shape IDs that need to get a ':regular' pseudo class in CSS
    const pseudoShapeMap: Record<string, boolean> = {};

    for (const shape of shapes) {
      pseudoShapeMap[shape.base] = pseudoShapeMap[shape.base] || Boolean(shape.state);
    }

    // Layout the sprite
    if (this.config.layout === 'packed') {
      this.#layoutBinPacked(pseudoShapeMap);
    } else {
      this.#layoutSimple(pseudoShapeMap);
    }

    this.data.spriteWidth = this.spriteWidth;
    this.data.spriteHeight = this.spriteHeight;

    // Refine the shape data
    const positionMap: Record<string, { x: number; y: number }> = {};
    let xmlDeclaration = '';
    let doctypeDeclaration = '';

    for (const [index, shape] of this.data.shapes.entries()) {
      const source = shapes[index];

      // Skip non-master shapes for all but orthogonal layouts
      if (!source || !(this.displaceable || !shape.master)) {
        continue;
      }

      xmlDeclaration ||= source.xmlDeclaration;
      doctypeDeclaration ||= source.doctypeDeclaration;

      const position = shape.position!;
      let x: number;
      let y: number;

      // For vertical layouts: Set the horizontal alignment
      if (this.config.layout === 'vertical') {
        x = source.align * 100;
        position.absolute.x = source.round((-x * (this.spriteWidth - shape.width.outer)) / 100);

        // Else: Determine the relative horizontal position
      } else {
        x = position.absolute.x
          ? (100 * Math.abs(position.absolute.x)) / (this.spriteWidth - shape.width.outer)
          : 0;
      }

      // For horizontal layouts: Set the vertical alignment
      if (this.config.layout === 'horizontal') {
        y = source.align * 100;
        position.absolute.y = source.round((-y * (this.spriteHeight - shape.height.outer)) / 100);

        // Else: Determine the relative vertical position
      } else {
        y = position.absolute.y
          ? (100 * Math.abs(position.absolute.y)) / (this.spriteHeight - shape.height.outer)
          : 0;
      }

      // Set the relative position
      position.relative = {
        x: this.#round(x),
        y: this.#round(y),
        xy: `${this.addUnit(this.#round(x), '%')} ${this.addUnit(this.#round(y), '%')}`
      };

      if (!shape.master) {
        positionMap[source.id] = { x: position.absolute.x, y: position.absolute.y };
      }

      // Rework zero-valued positions
      const svg = shape.svg.split('>');
      let head = svg[0] ?? '';

      // Replace zero-valued x-positions
      const svgX = head.split(' x="0"');

      if (svgX.length > 1) {
        const master = shape.master ? positionMap[shape.master] : undefined;

        x = master ? position.absolute.x - master.x : position.absolute.x;
        head = svgX.join(x ? ` x="${-x}"` : '');
      }

      // Replace zero-valued y-positions
      const svgY = head.split(' y="0"');

      if (svgY.length > 1) {
        const master = shape.master ? positionMap[shape.master] : undefined;

        y = master ? position.absolute.y - master.y : position.absolute.y;
        head = svgY.join(y ? ` y="${-y}"` : '');
      }

      svg[0] = head;
      shape.svg = svg.join('>');
    }

    // Remove all non-master shapes for non-displaceable sprites
    if (!this.displaceable) {
      this.data.shapes = this.data.shapes.filter((shape) => !shape.master);
    }

    return { xmlDeclaration, doctypeDeclaration };
  }

  #layoutSimple(pseudoShapeMap: Record<string, boolean>): void {
    const { shapes } = this.spriter;
    const lastShapeIndex = shapes.length - 1;

    for (const [index, shape] of shapes.entries()) {
      if (this.displaceable || !shape.master) {
        this.#addShapeToSimpleCssSprite(
          shape,
          pseudoShapeMap[shape.base] ?? false,
          index,
          (index === 0 ? RELATIVE_SUFFIX_FIRST : 0) |
            (index === lastShapeIndex ? RELATIVE_SUFFIX_LAST : 0)
        );
      }
    }
  }

  #addShapeToSimpleCssSprite(
    shape: SvgShape,
    needsRegular: boolean,
    index: number,
    position: number
  ): void {
    const { width, height } = shape.getDimensions();
    const rootAttributes: RootAttributes = { id: shape.id };
    let positionX = 0;
    let positionY = 0;

    switch (this.config.layout) {
      // Horizontal sprite arrangement
      case 'horizontal': {
        rootAttributes['y'] = 0;
        rootAttributes['x'] = this.spriteWidth;
        positionX = -this.spriteWidth;

        this.spriteWidth = Math.ceil(this.spriteWidth + width);
        this.spriteHeight = Math.max(this.spriteHeight, height);
        break;
      }

      // Diagonal sprite arrangement
      case 'diagonal': {
        rootAttributes['x'] = this.spriteWidth;
        rootAttributes['y'] = this.spriteHeight;
        positionX = -this.spriteWidth;
        positionY = -this.spriteHeight;

        this.spriteWidth = Math.ceil(this.spriteWidth + width);
        this.spriteHeight = Math.ceil(this.spriteHeight + height);
        break;
      }

      // Vertical sprite arrangement (default)
      default: {
        rootAttributes['x'] = 0;
        rootAttributes['y'] = this.spriteHeight;
        positionY = -this.spriteHeight;

        this.spriteWidth = Math.max(this.spriteWidth, width);
        this.spriteHeight = Math.ceil(this.spriteHeight + height);
      }
    }

    this.#addShapeToCssSprite(
      shape,
      needsRegular,
      index,
      position,
      this.refineRootAttributes(shape, rootAttributes),
      positionX,
      positionY
    );
  }

  #layoutBinPacked(pseudoShapeMap: Record<string, boolean>): void {
    const { shapes } = this.spriter;
    const packer = new SvgSpriteCssPacker(shapes);
    const positions = packer.fit();
    const lastShapeIndex = shapes.length - 1;

    // Run through all shapes and add them to the sprite
    for (const [index, shape] of shapes.entries()) {
      // Skip non-master shapes
      if (shape.master) {
        continue;
      }

      const dimensions = shape.getDimensions();
      const position = positions[index]!;
      const rootAttributes: RootAttributes = { id: shape.id, x: position.x, y: position.y };

      this.spriteWidth = Math.max(this.spriteWidth, Math.ceil(position.x + dimensions.width));
      this.spriteHeight = Math.max(this.spriteHeight, Math.ceil(position.y + dimensions.height));

      this.#addShapeToCssSprite(
        shape,
        pseudoShapeMap[shape.base] ?? false,
        index,
        (index === 0 ? RELATIVE_SUFFIX_FIRST : 0) |
          (index === lastShapeIndex ? RELATIVE_SUFFIX_LAST : 0),
        this.refineRootAttributes(shape, rootAttributes),
        -position.x,
        -position.y
      );
    }
  }

  #dimensionSelectors(shape: SvgShape, template: string): SelectorPart[] {
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

  #addShapeToCssSprite(
    shape: SvgShape,
    needsRegular: boolean,
    index: number,
    position: number,
    rootAttributes: RootAttributes,
    positionX: number,
    positionY: number
  ): void {
    const { prefix, dimensions } = this.config;
    const state = shape.state ? `:${shape.state}` : '';

    // Prepare the selectors
    const selector: NonNullable<ShapeData['selector']> = {
      shape:
        needsRegular || shape.state
          ? [
              {
                expression: format(prefix, shape.base + state),
                raw: format(prefix, shape.base + state),
                first: true,
                last: false
              },
              {
                expression: format(prefix, `${shape.base}\\:${shape.state || 'regular'}`),
                raw: format(prefix, `${shape.base}:${shape.state || 'regular'}`),
                first: false,
                last: true
              }
            ]
          : [
              {
                expression: format(prefix, shape.base),
                raw: format(prefix, shape.base),
                first: true,
                last: true
              }
            ]
    };

    // Prepare the dimension properties
    if (typeof dimensions === 'string' && dimensions) {
      selector.dimensions = this.#dimensionSelectors(shape, dimensions);
    }

    const current = this.data.shapes[index]!;

    // Register the SVG parameters
    this.data.shapes[index] = withLazySvg(
      {
        ...current,
        first: Boolean(position & RELATIVE_SUFFIX_FIRST),
        last: Boolean(position & RELATIVE_SUFFIX_LAST),
        position: {
          absolute: {
            x: positionX,
            y: positionY,
            xy: `${this.addUnit(positionX, 'px')} ${this.addUnit(positionY, 'px')}`
          }
        },
        selector,
        dimensions: {
          inline: dimensions === true,
          extra: typeof dimensions === 'string' && dimensions.length > 0
        }
      },
      () =>
        shape.getSVG(true, (element: Element) => {
          for (const [attribute, value] of Object.entries(rootAttributes)) {
            element.setAttribute(attribute, String(value));
          }
        })
    );
  }

  /** Build the CSS sprite */
  protected buildSvg(xmlDeclaration: string, doctypeDeclaration: string): SpriteFile {
    const rootAttributes: RootAttributes = {
      ...this.config.svg.rootAttributes,
      ...(this.config.svg.dimensionAttributes
        ? { width: this.spriteWidth, height: this.spriteHeight }
        : {}),
      viewBox: `0 0 ${this.spriteWidth} ${this.spriteHeight}`
    };
    const xml = this.declaration(this.config.svg.xmlDeclaration, xmlDeclaration);
    const doctype = this.declaration(this.config.svg.doctypeDeclaration, doctypeDeclaration);
    const svg = new SvgSprite(xml, doctype, rootAttributes, true, this.config.svg.transform);

    svg.add(this.data.shapes.map((shape) => shape.svg));

    return svg.toFile(this.spriter.config.dest, this.addCacheBusting(svg));
  }

  #round(n: number): number {
    return this.#precision ? Math.round(n * this.#precision) / this.#precision : n;
  }
}
