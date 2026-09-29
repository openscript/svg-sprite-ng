import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../../../src/index.ts';

describe('resolveConfig svg', () => {
  it('merges config.svg into the defaults', () => {
    const config = resolveConfig({
      svg: { rootAttributes: { role: 'img' }, namespaceIDPrefix: 'icon-' },
      log: false
    });

    expect(config.svg).toStrictEqual(
      expect.objectContaining({
        namespaceIDPrefix: 'icon-',
        rootAttributes: { role: 'img' }
      })
    );
  });

  it('defaults svg options when omitted', () => {
    expect(resolveConfig({ log: false }).svg).toStrictEqual({
      doctypeDeclaration: true,
      xmlDeclaration: true,
      namespaceIDs: true,
      namespaceIDPrefix: '',
      namespaceClassnames: true,
      dimensionAttributes: true,
      rootAttributes: {},
      precision: -1,
      transform: []
    });
  });

  it.each(['xmlDeclaration', 'doctypeDeclaration'] as const)(
    'resolves %s from defaults, explicit strings and false',
    (field) => {
      const value = `test-${field}`;
      const explicitSvg =
        field === 'xmlDeclaration'
          ? ({ xmlDeclaration: value } as const)
          : ({ doctypeDeclaration: value } as const);
      const disabledSvg =
        field === 'xmlDeclaration'
          ? ({ xmlDeclaration: false } as const)
          : ({ doctypeDeclaration: false } as const);
      const config = resolveConfig({ svg: explicitSvg, log: false });

      expect(config.svg[field]).toBe(value);
      expect(resolveConfig({ log: false }).svg[field]).toBe(true);
      expect(resolveConfig({ svg: disabledSvg, log: false }).svg[field]).toBe(false);
    }
  );

  it('resolves dimensionAttributes from defaults and explicit booleans', () => {
    expect(resolveConfig({ log: false }).svg.dimensionAttributes).toBe(true);
    expect(
      resolveConfig({ svg: { dimensionAttributes: false }, log: false }).svg.dimensionAttributes
    ).toBe(false);
  });

  it('merges rootAttributes and falls back to an empty object', () => {
    expect(resolveConfig({ log: false }).svg.rootAttributes).toStrictEqual({});
    expect(
      resolveConfig({ svg: { rootAttributes: { focusable: 'false' } }, log: false }).svg
        .rootAttributes
    ).toStrictEqual({ focusable: 'false' });
  });

  it('clamps precision to -1 and keeps explicit values', () => {
    expect(resolveConfig({ log: false }).svg.precision).toBe(-1);
    expect(resolveConfig({ svg: { precision: 10 }, log: false }).svg.precision).toBe(10);
    expect(resolveConfig({ svg: { precision: -10 }, log: false }).svg.precision).toBe(-1);
  });

  it('resolves svg.transform from functions', () => {
    const transform = vi.fn<(svg: string) => string>((svg: string) => svg);
    const transform2 = vi.fn<(svg: string) => string>((svg: string) => svg);

    expect(resolveConfig({ log: false }).svg.transform).toStrictEqual([]);
    expect(resolveConfig({ svg: { transform }, log: false }).svg.transform).toStrictEqual([
      transform
    ]);
    expect(
      resolveConfig({ svg: { transform: [transform, transform2] }, log: false }).svg.transform
    ).toStrictEqual([transform, transform2]);
  });
});
