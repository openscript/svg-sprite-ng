import path from 'node:path';
import { format } from 'node:util';
import type { Document, Element } from '@xmldom/xmldom';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import cssom from 'cssom';
import type { CssRule } from 'cssom';
import { CssSelectorParser } from 'css-selector-parser';
import { ArgumentError } from './errors/argument-error.ts';
import { NotPermittedError } from './errors/not-permitted-error.ts';
import type { SpriteFile } from './file.ts';
import type {
  BoxSizing,
  Padding,
  ResolvedShapeIdConfig,
  ResolvedShapeMeta,
  SpriterContext
} from './types.ts';
import { calculateSvgDimensions } from './utils/calculate-svg-dimensions.ts';
import { fixXmlString } from './utils/fix-xml-string.ts';
import { isString } from './utils/guards.ts';
import {
  DEFAULT_SVG_NAMESPACE,
  ELEMENT_NODE,
  XLINK_NAMESPACE,
  createSvgSelector,
  getNamespaceMap,
  selectAttributes,
  selectElements
} from './utils/xml.ts';

const DEFAULT_XML_DECLARATION = '<?xml version="1.0" encoding="utf-8"?>';

const SVG_REFERENCE_PROPERTIES: readonly string[] = [
  'style',
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-end',
  'marker-mid'
];

type Substitutions = Record<string, string>;

/** Loose shape of the parse result of `css-selector-parser`. */
interface ParsedSelector {
  rule?: ParsedSelector;
  selectors?: ParsedSelector[];
  id?: string;
  classNames?: string[];
}

/** The shape configuration of a single shape (mutable, because "icon" box sizing adds padding). */
export interface ShapeInstanceConfig {
  id: ResolvedShapeIdConfig;
  dimension: { maxWidth: number; maxHeight: number; precision: number; attributes: boolean };
  spacing: { padding: Padding; box: BoxSizing };
}

export interface Dimensions {
  width: number;
  height: number;
}

export type ViewBox = [x: number, y: number, width: number, height: number];

/** A single SVG shape. */
export class SvgShape {
  readonly source: SpriteFile;
  readonly spriter: SpriterContext;
  svg: { current: string; ready: string | null };
  readonly name: string;
  readonly config: ShapeInstanceConfig;
  id: string;
  state: string | null;
  base: string;
  master: SvgShape | null = null;
  copies = 0;
  meta: ResolvedShapeMeta;
  /** Alignment templates and values (before distribution) */
  readonly alignments: [template: string, value: number][];
  /** Alignment value of this shape (after distribution) */
  align = 0;
  dom!: Document;
  width = 0;
  height = 0;
  viewBox: ViewBox | false = false;
  title: Element | null = null;
  description: Element | null = null;
  xmlDeclaration: string;
  doctypeDeclaration: string;

  #scale = 1;
  #namespaced = false;
  readonly #precision: number;

  constructor(file: SpriteFile, spriter: SpriterContext) {
    this.source = file;
    this.spriter = spriter;
    this.svg = { current: file.contents.toString(), ready: null };
    this.name = file.path.slice(file.base.length + path.sep.length);

    const shapeConfig = spriter.config.shape;
    this.config = {
      id: shapeConfig.id,
      dimension: { ...shapeConfig.dimension },
      spacing: { padding: { ...shapeConfig.spacing.padding }, box: shapeConfig.spacing.box }
    };

    this.id = this.config.id.generator.call(this.config.id, this.name, this.source);
    const [base = '', state] = this.id.split(this.config.id.pseudo);
    this.base = base;
    this.state = state || null;
    this.#precision = 10 ** this.config.dimension.precision;

    // Determine meta & alignment data
    const relative = path.basename(file.relative, '.svg');
    const { meta, align } = shapeConfig;
    this.meta = meta[this.id] ?? meta[relative] ?? {};
    this.alignments = Object.entries({
      ...align['*'],
      ...(align[this.id] ?? align[relative])
    });

    // Initially set the SVG of this shape
    this.#initSvg();

    // XML declaration and doctype
    this.xmlDeclaration = /<\?xml.*?>/.exec(this.svg.current)?.[0] ?? DEFAULT_XML_DECLARATION;
    this.doctypeDeclaration = /<!DOCTYPE.*?>/.exec(this.svg.current)?.[0] ?? '';

    spriter.verbose('Added shape "%s:%s"', this.base, this.state ?? 'regular');
  }

  toString(): string {
    return '[object SVGShape]';
  }

  /** Recursively strip unneeded namespace declarations */
  #stripInlineNamespaceDeclarations(element: Element, nsMap?: Record<string, string>): Element {
    const parentNsMap = { ...getNamespaceMap(element) };
    const map = nsMap ?? { '': DEFAULT_SVG_NAMESPACE };

    // Strip the default SVG namespace
    if (map[''] === DEFAULT_SVG_NAMESPACE) {
      const defaultNamespace = element.attributes.getNamedItem('xmlns');
      if (defaultNamespace?.value === DEFAULT_SVG_NAMESPACE) {
        element.attributes.removeNamedItem('xmlns');
      }
    }

    if (!('xlink' in map) || map['xlink'] === XLINK_NAMESPACE) {
      const xlinkNamespace = element.attributes.getNamedItem('xmlns:xlink');
      if (xlinkNamespace?.value === XLINK_NAMESPACE) {
        element.attributes.removeNamedItem('xmlns:xlink');
      }
    }

    for (let index = 0; index < element.childNodes.length; index++) {
      const child = element.childNodes.item(index);
      if (child?.nodeType === ELEMENT_NODE) {
        this.#stripInlineNamespaceDeclarations(child as Element, parentNsMap);
      }
    }

    return element;
  }

  /**
   * Return the SVG of this shape
   *
   * @param inline     Prepare for inline usage (strip redundant XML namespaces)
   * @param transform  Final transformer before serialization (operating on a clone)
   */
  getSVG(inline: boolean, transform?: (element: Element) => void): string {
    let svg: Element;

    // If this is a distributed copy
    if (this.master) {
      svg = this.dom.createElementNS(DEFAULT_SVG_NAMESPACE, 'use');
      svg.setAttribute('xlink:href', `#${this.master.id}`);
    } else {
      svg = this.dom.documentElement!.cloneNode(true) as Element;
    }

    transform?.(svg);

    // If the SVG is to be used inline or as part of a sprite or is a distributed copy: Strip redundant namespace declarations
    if (inline || this.master) {
      // xmldom 0.9 re-declares the (stripped) XLink namespace on every element that uses it: remove those again
      return new XMLSerializer()
        .serializeToString(this.#stripInlineNamespaceDeclarations(svg))
        .replaceAll(` xmlns:xlink="${XLINK_NAMESPACE}"`, '');
    }

    // Else: Add XML and DOCTYPE declarations if required
    let serialized = new XMLSerializer().serializeToString(svg);

    if (this.spriter.config.svg.doctypeDeclaration) {
      serialized = this.doctypeDeclaration + serialized;
    }

    if (this.spriter.config.svg.xmlDeclaration) {
      serialized = this.xmlDeclaration + serialized;
    }

    return serialized;
  }

  /** Set the SVG of this shape */
  setSVG(svg: string): this {
    this.svg.current = svg;
    this.svg.ready = null;
    return this.#initSvg();
  }

  #root(): Element {
    const root = this.dom.documentElement;

    if (!root) {
      throw new ArgumentError('Invalid SVG file (missing root element)');
    }

    return root;
  }

  /** Initialize the SVG of this shape */
  #initSvg(): this {
    // Basic check for basic SVG file structure
    const validSVGRegExp = /<svg(?:\s+[a-z\d-:]+=(["']).*?\1)*\s*(?:(\/)|(>[^]*<\/svg))>/i;
    let svgStart = validSVGRegExp.exec(this.svg.current);

    if (!svgStart) {
      try {
        const fixedXMLString = fixXmlString(this.svg.current);
        svgStart = validSVGRegExp.exec(fixedXMLString);

        if (svgStart) {
          this.svg.current = fixedXMLString;
        }
      } catch {
        svgStart = null;
      }

      if (!svgStart) {
        throw new ArgumentError('Invalid SVG file');
      }
    }

    // Resolve XML entities
    const entityRegExp = /<!ENTITY\s+(\S+)\s+(["'])(.+)\2>/;
    const entityMap: Record<string, string> = {};
    let entityStart = 0;
    let entity: RegExpExecArray | null;

    do {
      entity = entityRegExp.exec(this.svg.current.slice(entityStart));
      if (entity) {
        entityStart += entity.index + entity[0].length;
        entityMap[entity[1] ?? ''] = entity[3] ?? '';
      }
    } while (entity);

    if (Object.keys(entityMap).length > 0) {
      let svg = this.svg.current.slice(svgStart.index);
      for (const [key, value] of Object.entries(entityMap)) {
        svg = svg.replace(`&${key};`, value);
      }

      this.svg.current = this.svg.current.slice(0, svgStart.index) + svg;
    }

    // Parse the XML
    this.dom = this.#parse(this.svg.current);
    const root = this.#root();

    // Determine the shape width & height
    const width = root.getAttribute('width') ?? '';
    this.width = width.length > 0 ? Number.parseFloat(width) : 0;
    const height = root.getAttribute('height') ?? '';
    this.height = height.length > 0 ? Number.parseFloat(height) : 0;

    // Determine the viewbox
    const viewBox = root.getAttribute('viewBox') ?? '';
    if (viewBox.length > 0) {
      const parts = viewBox.split(/[^-\d.]+/).map(Number.parseFloat);
      while (parts.length < 4) {
        parts.push(0);
      }

      this.viewBox = parts as ViewBox;
    } else {
      this.viewBox = false;
    }

    this.title = null;
    this.description = null;

    const { childNodes } = root;

    for (let index = 0; index < childNodes.length; index++) {
      const child = childNodes.item(index) as Element | null;

      if (child?.localName === 'title') {
        this.title = child;
      } else if (child?.localName === 'desc') {
        this.description = child;
      }
    }

    return this;
  }

  #parse(svg: string): Document {
    let firstError: string | null = null;

    try {
      const dom = new DOMParser({
        onError(_level, message) {
          firstError ??= message;
        }
      }).parseFromString(svg, 'text/xml');

      if (firstError === null) {
        return dom;
      }
    } catch (error) {
      firstError ??= error instanceof Error ? error.message : String(error);
    }

    throw new ArgumentError(format('Invalid SVG file (%s)', firstError.split('\n').join(' ')));
  }

  getDimensions(): Dimensions {
    return { width: this.width, height: this.height };
  }

  setDimensions(width: number | string, height: number | string): this {
    this.width = this.round(Math.max(0, Number.parseFloat(String(width))));
    this.#root().setAttribute('width', String(this.width));
    this.height = this.round(Math.max(0, Number.parseFloat(String(height))));
    this.#root().setAttribute('height', String(this.height));
    return this;
  }

  /** Return the shape's viewBox (and set it if it doesn't exist yet) */
  getViewbox(width?: number, height?: number): ViewBox {
    return this.viewBox || this.setViewbox(0, 0, width || this.width, height || this.height);
  }

  /** Set the shape's viewBox */
  setViewbox(x: number | readonly number[], y = 0, width = 0, height = 0): ViewBox {
    if (typeof x === 'number') {
      this.viewBox = [x, y, width, height].map((n) => Number.parseFloat(String(n))) as ViewBox;
    } else {
      const parts = x.map((n) => Number.parseFloat(String(n)));
      while (parts.length < 4) {
        parts.push(0);
      }

      this.viewBox = parts as ViewBox;
    }

    this.#root().setAttribute('viewBox', this.viewBox.join(' '));
    return this.viewBox;
  }

  /** Complement the SVG shape by adding dimensions, padding and meta data */
  async complement(): Promise<this> {
    await this.#complementDimensions();
    this.#addPadding();
    this.#addMetadata();

    // Save the transformed state
    this.svg.ready = new XMLSerializer().serializeToString(this.#root());

    return this;
  }

  async #complementDimensions(): Promise<void> {
    if (!this.width || !this.height) {
      await this.#determineDimensions();
    }

    this.#setDimensions();
  }

  /** Determine the shape's dimension by rendering it */
  async #determineDimensions(): Promise<void> {
    // Try to use a viewBox attribute for image determination
    if (this.viewBox !== false) {
      this.width = this.round(this.viewBox[2]);
      this.height = this.round(this.viewBox[3]);
    }

    // If the viewBox attribute didn't suffice: Render the SVG image
    if (!this.width || !this.height) {
      const { width, height } = await calculateSvgDimensions(this.getSVG(false));
      this.height = this.round(height);
      this.width = this.round(width);
    }
  }

  /** Round a number considering the given decimal place precision */
  round(n: number): number {
    return Math.round(n * this.#precision) / this.#precision;
  }

  /** Scale the shape if necessary */
  #setDimensions(): void {
    // Ensure the original viewBox is set
    this.getViewbox(this.width, this.height);

    const { spacing, dimension } = this.config;
    const includePadding = spacing.box === 'padding' || spacing.box === 'icon';
    const forceScale = spacing.box === 'icon';
    const horizontalPadding = includePadding
      ? Math.max(0, spacing.padding.right + spacing.padding.left)
      : 0;
    const width = this.width + horizontalPadding;
    const verticalPadding = includePadding
      ? Math.max(0, spacing.padding.top + spacing.padding.bottom)
      : 0;
    const height = this.height + verticalPadding;

    // Does the shape need to be scaled?
    if (
      width > dimension.maxWidth ||
      height > dimension.maxHeight ||
      (forceScale && width < dimension.maxWidth && height < dimension.maxHeight)
    ) {
      const maxWidth = dimension.maxWidth - horizontalPadding;
      const maxHeight = dimension.maxHeight - verticalPadding;
      this.#scale = Math.min(maxWidth / this.width, maxHeight / this.height);
      this.width = Math.min(maxWidth, this.round(this.width * this.#scale));
      this.height = Math.min(maxHeight, this.round(this.height * this.#scale));
    }

    // In "icon" box sizing mode: Resize bounding box and center shape by adding padding
    if (forceScale) {
      const diffWidth = dimension.maxWidth - this.width - horizontalPadding;
      const diffHeight = dimension.maxHeight - this.height - verticalPadding;
      spacing.padding.left += diffWidth / 2;
      spacing.padding.right += diffWidth / 2;
      spacing.padding.top += diffHeight / 2;
      spacing.padding.bottom += diffHeight / 2;
    }

    this.#root().setAttribute('width', String(this.width));
    this.#root().setAttribute('height', String(this.height));
  }

  /** Add padding to this shape */
  #addPadding(): void {
    const { padding } = this.config.spacing;

    if (padding.top || padding.right || padding.bottom || padding.left) {
      // Update viewBox
      const viewBox = [...this.getViewbox()] as ViewBox;
      viewBox[0] -= padding.left / this.#scale;
      viewBox[1] -= padding.top / this.#scale;
      viewBox[2] += (padding.right + padding.left) / this.#scale;
      viewBox[3] += (padding.top + padding.bottom) / this.#scale;
      this.setViewbox(viewBox.map((n) => this.round(n)));

      // Update dimensions
      this.setDimensions(
        this.width + padding.right + padding.left,
        this.height + padding.top + padding.bottom
      );
    }
  }

  /** Add metadata to this shape */
  #addMetadata(): void {
    const root = this.#root();
    const ariaLabelledBy: string[] = [];

    // Check if description meta data is available
    if (isString(this.meta.description) && this.meta.description.length > 0) {
      this.description ??= root.insertBefore(
        this.dom.createElementNS(DEFAULT_SVG_NAMESPACE, 'desc'),
        root.firstChild
      ) as Element;
      this.description.textContent = this.meta.description;
      this.description.setAttribute('id', `${this.id}-desc`);
      ariaLabelledBy.push(`${this.id}-desc`);
    }

    // Check if title meta data is available
    if (isString(this.meta.title) && this.meta.title.length > 0) {
      this.title ??= root.insertBefore(
        this.dom.createElementNS(DEFAULT_SVG_NAMESPACE, 'title'),
        root.firstChild
      ) as Element;
      this.title.textContent = this.meta.title;
      this.title.setAttribute('id', `${this.id}-title`);
      ariaLabelledBy.push(`${this.id}-title`);
    }

    if (ariaLabelledBy.length > 0) {
      root.setAttribute('aria-labelledby', ariaLabelledBy.join(' '));
    } else if (root.hasAttribute('aria-labelledby')) {
      root.removeAttribute('aria-labelledby');
    }
  }

  /** Apply a namespace prefix to all IDs within the SVG document */
  async setNamespace(ns: string): Promise<void> {
    const { namespaceIDs, namespaceClassnames } = this.spriter.config.svg;
    const namespaceIDPrefix = this.spriter.config.svg.namespaceIDPrefix || '';

    if (this.#namespaced || (!namespaceIDs && !namespaceClassnames)) {
      return;
    }

    // Ensure the shape has been complemented before
    if (!this.svg.ready) {
      throw new NotPermittedError('Shape namespace cannot be set before complementing');
    }

    const select = createSvgSelector();
    const root = this.#root();
    let substIds: Substitutions | null = null;
    let substClassnames: Substitutions | null = null;

    // If IDs should be namespaced
    if (namespaceIDs) {
      // Build an ID substitution table (and alter the elements' IDs accordingly)
      const ids: Substitutions = {};
      substIds = ids;

      for (const elem of selectElements(select, '//*[@id]', this.dom)) {
        const id = elem.getAttribute('id') ?? '';
        const substId = namespaceIDPrefix + ns + id;
        ids[`#${id}`] = substId;
        elem.setAttribute('id', substId);
      }

      // Substitute ID references in xlink:href and href attributes
      for (const [attribute, expression] of [
        ['xlink:href', '//@xlink:href'],
        ['href', '//@href']
      ] as const) {
        for (const reference of selectAttributes(select, expression, this.dom)) {
          const value = reference.nodeValue ?? '';
          const substitution = ids[value];

          if (!value.startsWith('data:') && substitution !== undefined) {
            reference.ownerElement?.setAttribute(attribute, `#${substitution}`);
          }
        }
      }

      // Substitute ID references in referencing attributes
      for (const refProperty of SVG_REFERENCE_PROPERTIES) {
        for (const ref of selectAttributes(select, `//@${refProperty}`, this.dom)) {
          ref.ownerElement?.setAttribute(
            ref.localName ?? refProperty,
            this.#replaceIdAndClassnameReferences(
              ref.nodeValue ?? '',
              substIds,
              substClassnames,
              false
            )
          );
        }
      }

      // Substitute ID references in aria-labelledby attribute
      if (root.hasAttribute('aria-labelledby')) {
        root.setAttribute(
          'aria-labelledby',
          (root.getAttribute('aria-labelledby') ?? '')
            .split(' ')
            .map((label) => ids[`#${label}`] ?? label)
            .join(' ')
        );
      }
    }

    // If CSS class names should be namespaced
    if (namespaceClassnames) {
      // Build a class name substitution table (and alter the elements' class names accordingly)
      const classes: Substitutions = {};
      substClassnames = classes;

      for (const elem of selectElements(select, '//*[@class]', this.dom)) {
        const classnames: string[] = [];
        const trimmedClassnames = (elem.getAttribute('class') ?? '')
          .split(' ')
          .filter((classname) => classname.trim());

        for (const classname of trimmedClassnames) {
          const substClassname = ns + classname;
          classes[`.${classname}`] = substClassname;
          classnames.push(substClassname);
        }

        elem.setAttribute('class', classnames.join(' '));
      }
    }

    // Substitute ID references in <style> elements
    const styles = selectElements(select, '//svg:style', this.dom);
    if (styles.length > 0) {
      // Loaded on demand because csso increases the load time significantly
      const csso = await import('csso');

      for (const style of styles) {
        style.textContent = csso.minifyBlock(
          this.#replaceIdAndClassnameReferences(
            style.textContent ?? '',
            substIds,
            substClassnames,
            true
          ),
          { restructure: false }
        ).css;
      }
    }

    this.#namespaced = true;
  }

  /** Reset the shapes namespace */
  resetNamespace(): void {
    if (this.#namespaced && this.spriter.config.svg.namespaceIDs && this.svg.ready) {
      this.#namespaced = false;
      this.dom = new DOMParser().parseFromString(this.svg.ready, 'text/xml');
    }
  }

  /** Replace ID and class references */
  #replaceIdAndClassnameReferences(
    str: string,
    substIds: Substitutions | null,
    substClassnames: Substitutions | null,
    selectors: boolean
  ): string {
    let result = str;

    // If ID replacement is to be applied: Replace url()-style ID references
    if (substIds !== null) {
      result = result.replaceAll(/url\s*\(\s*["']?([^\s"')]+)["']?\s*\)/g, (_match, id: string) => {
        const substitution = substIds[id];
        return `url(${substitution === undefined ? id : `#${substitution}`})`;
      });
    }

    return selectors
      ? this.#replaceIdAndClassnameReferencesInCssSelectors(
        result,
        cssom.parse(result).cssRules,
        substIds,
        substClassnames
      )
      : result;
  }

  /** Recursively replace ID and class references in CSS selectors */
  #replaceIdAndClassnameReferencesInCssSelectors(
    str: string,
    rules: readonly CssRule[],
    substIds: Substitutions | null,
    substClassnames: Substitutions | null
  ): string {
    let css = '';

    for (const rule of rules) {
      if (rule.constructor.name === 'CSSFontFaceRule') {
        // Preserving @font-face rule
        css += `@font-face${str.slice(rule.__starts + 1, rule.__ends)}`;
        continue;
      }

      let selText = rule.selectorText;

      // @-rule
      if (selText === undefined) {
        // If there's a key text: Copy the CSS rule
        if (rule.keyText) {
          css += str.slice(rule.__starts, rule.__starts + rule.__ends);

          // Else: Recursively process rule content
        } else if (Array.isArray(rule.cssRules) && rule.cssRules.length > 0) {
          css +=
            str.slice(rule.__starts, rule.cssRules[0]?.__starts) +
            this.#replaceIdAndClassnameReferencesInCssSelectors(
              str,
              rule.cssRules,
              substIds,
              substClassnames
            ) +
            str.slice(rule.cssRules.at(-1)?.__ends, rule.__ends);
        }

        continue;
      }

      // Regular selector
      const origSelText = selText;
      let sel: ParsedSelector | undefined = new CssSelectorParser().parse(
        selText
      );
      const ids: string[] = [];
      const classnames = new Set<string>();

      const collect = (node: ParsedSelector): void => {
        const { rule: inner } = node;

        // If ID substitution should be applied: Search for an ID
        if (inner?.id !== undefined && substIds !== null && `#${inner.id}` in substIds) {
          ids.push(inner.id);
        }

        // If class name substitution should be applied: Search for class names
        if (substClassnames !== null && Array.isArray(inner?.classNames)) {
          for (const classname of inner.classNames) {
            if (`.${classname}` in substClassnames) {
              classnames.add(classname);
            }
          }
        }
      };

      // If there are multiple subselectors, substitute all of them
      for (const selector of sel?.selectors ?? []) {
        collect(selector);
      }

      // While there are nested rules: Substitute and recurse
      while (typeof sel === 'object' && sel.rule) {
        collect(sel);
        sel = sel.rule;
      }

      // Substitute IDs within the selector
      for (const id of ids.toSorted((a, b) => b.length - a.length)) {
        selText = selText.split(`#${id}`).join(`#${substIds?.[`#${id}`] ?? id}`);
      }

      // Substitute class names within the selector
      for (const classname of [...classnames].toSorted((a, b) => b.length - a.length)) {
        selText = selText
          .split(`.${classname}`)
          .join(`.${substClassnames?.[`.${classname}`] ?? classname}`);
      }

      // Rebuild the selector
      css += selText + str.slice(rule.__starts + origSelText.length, rule.__ends);
    }

    return css;
  }

  /** Distribute the shape to several copies (if configured) */
  distribute(): SvgShape[] {
    const [first, ...remaining] = this.alignments;
    const { base } = this;
    const pseudo = this.state ? this.config.id.pseudo + this.state : '';
    const copies: SvgShape[] = [this];

    this.base = format(first?.[0] ?? '%s', this.base);
    this.id = this.base + pseudo;
    this.align = first?.[1] ?? 0;

    // Run through all remaining alignments
    for (const [template, value] of remaining) {
      const copy = this.#createCopy();
      copy.base = format(template, base);
      copy.id = copy.base + pseudo;
      copy.align = value;
      copy.master = this;
      copies.push(copy);
    }

    this.copies = remaining.length;
    return copies;
  }

  #createCopy(): SvgShape {
    const copy = new SvgShape(this.source, this.spriter);
    copy.svg = { ...this.svg };
    copy.dom = this.dom;
    copy.width = this.width;
    copy.height = this.height;
    copy.viewBox = this.viewBox ? ([...this.viewBox] as ViewBox) : false;
    copy.title = this.title;
    copy.description = this.description;
    copy.xmlDeclaration = this.xmlDeclaration;
    copy.doctypeDeclaration = this.doctypeDeclaration;
    copy.meta = this.meta;
    copy.state = this.state;
    copy.copies = this.copies;
    copy.#scale = this.#scale;
    copy.#namespaced = this.#namespaced;
    copy.config.spacing.padding = { ...this.config.spacing.padding };
    return copy;
  }
}
