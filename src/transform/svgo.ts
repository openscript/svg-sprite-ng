import type { Config, PluginConfig } from 'svgo';
import type { SvgShape } from '../shape.ts';
import type { SpriterContext } from '../types.ts';
import { formatSize } from '../utils/format-size.ts';

/**
 * The plugins svgo 3's `preset-default` ran (in order). svgo 4 dropped `removeTitle` and `removeViewBox`
 * from its preset and added `removeDeprecatedAttrs`, so the default is pinned explicitly to keep the
 * output of svg-sprite 3.x.
 */
export const DEFAULT_PLUGINS: readonly PluginConfig[] = [
  'removeDoctype',
  'removeXMLProcInst',
  'removeComments',
  'removeMetadata',
  'removeEditorsNSData',
  'cleanupAttrs',
  'mergeStyles',
  'inlineStyles',
  'minifyStyles',
  'cleanupIds',
  'removeUselessDefs',
  'cleanupNumericValues',
  'convertColors',
  'removeUnknownsAndDefaults',
  'removeNonInheritableGroupAttrs',
  'removeUselessStrokeAndFill',
  'removeViewBox',
  'cleanupEnableBackground',
  'removeHiddenElems',
  'removeEmptyText',
  'convertShapeToPath',
  'convertEllipseToCircle',
  'moveElemsAttrsToGroup',
  'moveGroupAttrsToElems',
  'collapseGroups',
  'convertPathData',
  'convertTransform',
  'removeEmptyAttrs',
  'removeEmptyContainers',
  'mergePaths',
  'removeUnusedNS',
  'sortAttrs',
  'sortDefsChildren',
  'removeTitle',
  'removeDesc'
];

/** SVGO shape transformation. */
export async function svgoTransform(
  shape: SvgShape,
  config: Config,
  spriter: SpriterContext
): Promise<void> {
  const plugins: PluginConfig[] = [...(config.plugins ?? DEFAULT_PLUGINS)];

  // Remove the XML declaration if `svg.xmlDeclaration` is falsy
  if (!spriter.config.svg.xmlDeclaration) {
    plugins.push({ name: 'removeXMLProcInst' });
  }

  // Remove the doctype if `svg.doctypeDeclaration` is falsy
  if (!spriter.config.svg.doctypeDeclaration) {
    plugins.push({ name: 'removeDoctype' });
  }

  const svg = shape.getSVG(false);
  const svgLength = svg.length;

  try {
    const { optimize } = await import('svgo');
    const result = optimize(svg, { ...config, plugins });
    shape.setSVG(result.data);

    const size = svgLength - shape.getSVG(false).length;
    const percentage = Math.round((100 * size) / svgLength);
    spriter.debug(
      'Optimized "%s" with SVGO (saved %s / %s%%)',
      shape.name,
      formatSize(size),
      percentage
    );
  } catch (error) {
    spriter.error('Optimizing "%s" with SVGO failed with error "%s"', shape.name, error);
    throw error;
  }
}
