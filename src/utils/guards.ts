export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' || Object.prototype.toString.call(value) === '[object String]';
}

export function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

/** Trim the given characters from the start of a string (order of characters does not matter). */
export function trimStart(inputString: string, charsToTrim = ' '): string {
  if (!inputString) {
    return '';
  }

  // oxlint-disable-next-line typescript/no-misused-spread -- code points are fine for the trimmed characters
  const firstNonTrimCharIndex = [...inputString].findIndex((char) => !charsToTrim.includes(char));
  return inputString.slice(firstNonTrimCharIndex);
}
