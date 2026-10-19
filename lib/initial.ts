/** First character of a name/username, uppercased — avatar fallback. */
export function initial(name?: string | null): string {
  // By code point, not UTF-16 unit, so an emoji or a rare CJK letter isn't
  // cut in half.
  const ch = Array.from((name ?? "").trim())[0] ?? "";
  return ch ? ch.toUpperCase() : "?";
}
