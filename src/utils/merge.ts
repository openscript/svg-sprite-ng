import { isPlainObject } from './guards.ts';

/** Deep merge plain objects (later sources win). Arrays and other values are replaced, not merged. */
export function deepMerge(
  ...sources: readonly (Record<string, unknown> | null | undefined)[]
): Record<string, unknown> {
  const target: Record<string, unknown> = {};

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      const current = target[key];

      if (isPlainObject(value)) {
        target[key] = deepMerge(isPlainObject(current) ? current : {}, value);
      } else if (value !== undefined) {
        target[key] = value;
      }
    }
  }

  return target;
}
