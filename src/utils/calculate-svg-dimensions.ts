import { DimensionsCalculationError } from '../errors/dimensions-calculation-error.ts';

export interface Dimension {
  width: number;
  height: number;
}

/** Calculate the rendered dimensions of an SVG. */
export async function calculateSvgDimensions(svg: string): Promise<Dimension> {
  try {
    // Loaded on demand so that the native module does not increase the load time
    const { Resvg } = await import('@resvg/resvg-js');
    const { width, height } = new Resvg(svg, {
      logLevel: 'error',
      font: {
        // Faster with system fonts disabled
        loadSystemFonts: false
      }
    });

    return { width, height };
  } catch (error) {
    throw new DimensionsCalculationError(error instanceof Error ? error.message : String(error), {
      cause: error
    });
  }
}
