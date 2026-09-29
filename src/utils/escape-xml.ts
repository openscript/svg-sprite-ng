const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Escape the characters that are significant in XML/HTML attribute values. */
export function escapeXml(value: unknown): string {
  return String((value as string | number | boolean | null | undefined) ?? '').replaceAll(
    /[&<>"']/g,
    (char) => ESCAPES[char] ?? char
  );
}
