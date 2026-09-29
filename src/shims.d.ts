declare module 'cssom' {
  export interface CssRule {
    constructor: { name: string };
    selectorText?: string;
    keyText?: string;
    cssRules?: CssRule[];
    __starts: number;
    __ends: number;
  }

  const cssom: {
    parse: (text: string) => { cssRules: CssRule[] };
  };

  export default cssom;
}
