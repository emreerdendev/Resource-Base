import { CITIES, type City } from "@/lib/company-taxonomy";
import { slugify } from "@/lib/slug";

/**
 * Normalizers for user-entered company data. Isomorphic: the suggestion form
 * uses them for instant feedback (and to tidy values on blur), the API for the
 * authoritative check. Each returns the cleaned value, or null when invalid.
 */

const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

/** A real-looking http(s) URL: no spaces/credentials, a dotted host with a TLD. */
export function normalizeWebUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 500 || /\s/.test(v)) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password || !HOST_RE.test(u.hostname)) return null;
  u.hash = "";
  return u.toString();
}

/**
 * LinkedIn company/school page → its jobs tab, the page that actually lists
 * openings: ".../company/acme", ".../company/acme/about/" or "/posts/" all
 * become "https://www.linkedin.com/company/acme/jobs/". Personal profiles
 * (/in/…) and other LinkedIn pages are rejected.
 */
export function normalizeLinkedinJobsUrl(raw: string): string | null {
  const url = normalizeWebUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/(company|school)\/([^/?#]+)/i);
  if (!m) return null;
  return `https://www.linkedin.com/${m[1].toLowerCase()}/${m[2]}/jobs/`;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)+[a-z]{2,}$/i;

export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().replace(/^mailto:/i, "").toLowerCase();
  return v.length <= 200 && EMAIL_RE.test(v) ? v : null;
}

/** "Berlin", "Berlin, Germany", "São Paulo, Brasil" — letters, spaces and . ' ( ) - */
const PLACE_RE =
  /^[\p{L}\p{M}][\p{L}\p{M} .'’()-]{0,39}(?:,\s*[\p{L}\p{M}][\p{L}\p{M} .'’()-]{1,39})?$/u;

export const MAX_OTHER_LOCATIONS = 3;

const CITY_LABELS: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [slugify(c), c]),
);

/**
 * A free-text location. Returns a known city slug when it names one of our
 * quick-pick cities (so "Istanbul" doesn't become a second İstanbul), a cleaned
 * "City, Country" string otherwise, or null when it isn't a plausible place.
 */
export function normalizeLocation(
  raw: string,
): { city: City } | { other: string } | null {
  const v = raw.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
  if (!PLACE_RE.test(v)) return null;
  const known = CITY_LABELS[slugify(v.split(",")[0])];
  if (known && !v.includes(",")) return { city: known };
  if (known && /,\s*(türkiye|turkiye|turkey)$/i.test(v)) return { city: known };
  // Capitalize each word so "berlin, germany" and "Berlin, Germany" are one place.
  const other = v.replace(/(^|[\s,(-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
  return { other };
}
