import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let templateRoot: string | undefined;

/**
 * Directory that contains the bundled Mustache templates. Resolved relative to this module so that it works
 * from the built package (`dist/tmpl`, or `tmpl` next to `dist`) as well as from the sources.
 */
export function getTemplateRoot(): string {
  if (templateRoot === undefined) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    templateRoot =
      ['tmpl', '../tmpl', '../../tmpl', '../../../tmpl']
        .map((candidate) => path.resolve(here, candidate))
        .find((candidate) => fs.existsSync(path.join(candidate, 'common'))) ??
      path.resolve(here, '../../tmpl');
  }

  return templateRoot;
}
