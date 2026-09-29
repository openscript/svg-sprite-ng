import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { XmlFixingError } from '../errors/xml-fixing-error.ts';

/** Repair an SVG string by round-tripping it through an XML parser. */
export function fixXmlString(svgString: string): string {
  let domParserError = false;
  const onError = (): void => {
    domParserError = true;
  };

  const fixedSVG = new XMLSerializer()
    .serializeToString(new DOMParser({ onError }).parseFromString(svgString, 'text/xml'))
    .replaceAll(/(\s)(\s+)/g, ' ');

  if (!domParserError) {
    return fixedSVG;
  }

  throw new XmlFixingError('Invalid XML string');
}
