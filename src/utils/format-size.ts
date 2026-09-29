const UNITS = ['Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const;

/** Format a byte count as a short human readable string (e.g. `1.6 kB`). */
export function formatSize(size: number): string {
  let formatted = '';

  for (const [index, unit] of UNITS.entries()) {
    const base = 1024 ** index;

    if (size >= base) {
      const fixed = (size / base).toFixed(1);
      formatted = `${fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed} ${unit}`;
    }
  }

  return formatted || '0 Bytes';
}
