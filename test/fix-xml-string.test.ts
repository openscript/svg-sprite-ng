import { describe, expect, it } from 'vitest';
import { fixXmlString } from '../src/utils/fix-xml-string.ts';

describe('fixXmlString()', () => {
  it('normalizes multiline XML attribute values', () => {
    expect(
      fixXmlString('<svg viewBox="0 0 16\n                                     16"></svg>')
    ).toBe('<svg viewBox="0 0 16 16"/>');
    expect(
      fixXmlString(`<svg fill="r
                                                            e
                                                            d"
                                                            viewBox="0 0 16
                                                                                                 16"></svg>`)
    ).toBe('<svg fill="r e d" viewBox="0 0 16 16"/>');
    expect(
      fixXmlString(`<svg fill="r
                                                            e
                                                            d"
                                                            viewBox="0
                                                            0
                                                            16
                                                            16"></svg>`)
    ).toBe('<svg fill="r e d" viewBox="0 0 16 16"/>');
  });

  it('round-trips already valid SVG unchanged except for XML serialization', () => {
    expect(fixXmlString('<svg viewBox="0 0 16 16"></svg>')).toBe('<svg viewBox="0 0 16 16"/>');
  });

  it('throws a parser error for invalid XML input', () => {
    expect(() => fixXmlString('<svg viewBox=></svg>')).toThrow(/expected|Invalid XML string/u);
  });
});
