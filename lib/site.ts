/** Canonical site URL, used for sitemap, JSON-LD and metadata. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const siteName = "Resource Base";
export const siteDescription =
  "A free, community-maintained directory of resources for development, design and more, companies with how to apply to each, and CVs.";

/** Where people reach us — also the address for content reports. */
export const contactEmail = "emreerden@pm.me";
