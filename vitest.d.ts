import 'vitest';

interface SvgSpriteMatchers<R = unknown> {
  toBeVisuallyEqualTo: (expectedPNGPath: string) => Promise<R>;
  toBeVisuallyCorrectAsHTMLTo: (expectedPNGPath: string) => Promise<R>;
}

declare module 'vitest' {
  // oxlint-disable-next-line typescript/no-explicit-any, typescript/no-empty-object-type
  interface Matchers<T = any> extends SvgSpriteMatchers<T> {}
}
