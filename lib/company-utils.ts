import type { Company } from "@/lib/types";

/** "jobs.lever.co/acme" → "jobs.lever.co" — compact label for a link. */
export function hostLabel(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return path && path.length <= 24 ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

/** Fallback search links for companies without contact info yet. */
export function searchLinks(name: string) {
  const q = encodeURIComponent(name);
  return {
    linkedin: `https://www.linkedin.com/search/results/companies/?keywords=${q}`,
    web: `https://duckduckgo.com/?q=${encodeURIComponent(`${name} kariyer careers`)}`,
  };
}

/**
 * True when at least one application channel is listed. The website alone
 * doesn't count — it's reachable from the company name, not a way to apply.
 */
export function hasContact(c: Company) {
  return Boolean(c.emails.length || c.careerLinks.length || c.linkedin);
}

/** Fisher–Yates — fresh order on every request (no ranking, by design). */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
