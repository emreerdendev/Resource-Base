import Fuse from "fuse.js";

const TR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

/** Lowercase, Turkish letters transliterated, accents stripped ("Çiçek" → "cicek"). */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Folded with everything but letters/digits removed ("Yapı Kredi" → "yapikredi"). */
export const compact = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");

/** Folded words separated by single spaces, with a leading space for word-start checks. */
const spaced = (s: string) => ` ${fold(s).replace(/[^a-z0-9]+/g, " ").trim()}`;

/** Typo tolerance only kicks in when nothing contains the query outright. */
const FUZZY_THRESHOLD = 0.3;
/** Below this length, substring hits ("ai" in "maintain") are mostly noise. */
const MIN_SUBSTRING = 3;

export type SearchField<T> = {
  get: (item: T) => string[];
  /**
   * "contains": anywhere (spacing-insensitive) — short labels like tags,
   * domains, names. "words": only at a word start — long free text such as
   * descriptions, where substring hits are noise.
   */
  match?: "contains" | "words";
};

/**
 * Site search shared by the company and resource directories and the ⌘K
 * palette. Two tiers:
 *  1. exact matches, insensitive to case, Turkish letters and spacing — the
 *     exact name, names starting with the query, names containing it, then each extra
 *     field group in priority order (e.g. tags before descriptions);
 *  2. only when tier 1 finds nothing, a strict fuzzy match on the name, so
 *     real typos ("codway" → Codeway) still work.
 * Plain fuzzy matching across every field was too loose ("mirsis" matched
 * "Amaris") and never matched Turkish spellings ("cicek" ≠ "Çiçek").
 */
export function createSearch<T>(
  items: T[],
  name: (item: T) => string,
  /** Extra text to match, highest priority first. */
  fields: SearchField<T>[] = [],
) {
  const rows = items.map((item) => {
    const n = name(item);
    return {
      item,
      name: compact(n),
      nameWords: spaced(n),
      nameFolded: fold(n),
      fields: fields.map((f) => {
        const text = f.get(item).join(" ");
        return { compact: compact(text), words: spaced(text), mode: f.match ?? "contains" };
      }),
    };
  });
  const fuse = new Fuse(rows, {
    keys: ["nameFolded"],
    threshold: FUZZY_THRESHOLD,
    ignoreLocation: true,
    // Don't penalize long names for their length.
    ignoreFieldNorm: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return (query: string): T[] => {
    const q = compact(query);
    if (!q) return items;
    if (q.length < 2) return rows.filter((r) => r.name.startsWith(q)).map((r) => r.item);
    const qWords = spaced(query);
    const substring = q.length >= MIN_SUBSTRING;
    const hit = (f: { compact: string; words: string; mode: string }) =>
      f.words.includes(qWords) || (f.mode === "contains" && substring && f.compact.includes(q));

    // Bucket 0: exact name; 1: name starts with q; 2: elsewhere in the name;
    // 3+: field group i.
    const buckets: T[][] = Array.from({ length: fields.length + 3 }, () => []);
    for (const r of rows) {
      if (r.name === q) buckets[0].push(r.item);
      else if (r.name.startsWith(q)) buckets[1].push(r.item);
      else if (r.nameWords.includes(qWords) || (substring && r.name.includes(q)))
        buckets[2].push(r.item);
      else {
        const i = r.fields.findIndex(hit);
        if (i !== -1) buckets[i + 3].push(r.item);
      }
    }
    const exact = buckets.flat();
    if (exact.length) return exact;

    return fuse
      .search(fold(query).trim())
      .filter((r) => (r.score ?? 1) <= FUZZY_THRESHOLD)
      .map((r) => r.item.item);
  };
}
