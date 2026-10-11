import Fuse from "fuse.js";
import type { Company } from "@/lib/types";

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
const compact = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");

const host = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Typo tolerance only kicks in when nothing contains the query outright. */
const FUZZY_THRESHOLD = 0.3;

/**
 * Company search used by the directory and the ⌘K palette. Two tiers:
 *  1. exact containment (case/Turkish-letter/space-insensitive) — names
 *     starting with the query, then names containing it, then the company's
 *     domain, email domains, clients or locations;
 *  2. only if tier 1 finds nothing, a strict fuzzy match on the name (typos).
 * Plain fuzzy matching across every field was too loose: "mirsis" also
 * matched "Amaris", and "cicek" never found "Çiçek Sepeti".
 */
export function createCompanySearch(companies: Company[]) {
  const rows = companies.map((c) => ({
    company: c,
    name: compact(c.name),
    nameFolded: fold(c.name),
    other: compact(
      [
        host(c.website),
        ...c.emails.map((e) => e.split("@")[1] ?? ""),
        ...c.clients,
        ...c.otherLocations,
      ].join(" "),
    ),
  }));
  const fuse = new Fuse(rows, {
    keys: ["nameFolded"],
    threshold: FUZZY_THRESHOLD,
    ignoreLocation: true,
    // Don't penalize long names ("Mirsis Bilgi Teknolojileri") for their length.
    ignoreFieldNorm: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return (query: string): Company[] => {
    const q = compact(query);
    if (q.length < 2) return q ? companies.filter((c) => compact(c.name).startsWith(q)) : companies;

    const starts: Company[] = [];
    const inName: Company[] = [];
    const inOther: Company[] = [];
    for (const r of rows) {
      if (r.name.startsWith(q)) starts.push(r.company);
      else if (r.name.includes(q)) inName.push(r.company);
      else if (r.other.includes(q)) inOther.push(r.company);
    }
    if (starts.length || inName.length || inOther.length) return [...starts, ...inName, ...inOther];

    return fuse
      .search(fold(query).trim())
      .filter((r) => (r.score ?? 1) <= FUZZY_THRESHOLD)
      .map((r) => r.item.company);
  };
}
