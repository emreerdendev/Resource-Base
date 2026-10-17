// U+2028/U+2029 built from code points so the source stays plain ASCII.
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/**
 * Serialize JSON-LD for an inline <script>. JSON.stringify leaves "<" as is,
 * so a name containing "</script>" would end the tag and run what follows;
 * escaping "<" (and the line separators JS treats as newlines) keeps any
 * user-supplied text inert.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}
