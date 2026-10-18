/**
 * Canonical site URL, used for sitemap, JSON-LD and metadata. Set
 * NEXT_PUBLIC_SITE_URL in the build; a production build without it uses the
 * real domain rather than baking "localhost" into canonical links.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  (process.env.NODE_ENV === "production" ? "https://resource-base.com" : "http://localhost:3000");

export const siteName = "Resource Base";
export const siteDescription =
  "A free, community-maintained directory of Resources for development, design and more, Companies with how to apply to each, and CVs.";

/** Where people reach us — also the address for content reports. */
export const contactEmail = "emreerden@pm.me";
