import { removeTempPath } from '../helpers/remove-temp-path.ts';

export default async function setup(): Promise<void> {
  await removeTempPath();
}
