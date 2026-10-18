import "server-only";

import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "../env";

/**
 * Read client used by the public site (Server Components only — it carries a
 * Viewer token, so it must never be imported into a Client Component).
 * Caching is handled by Next.js via `sanityFetch` (tag-based, revalidated by
 * the Sanity webhook). `useCdn: true` additionally serves cache-miss and
 * revalidation reads from Sanity's edge CDN (published perspective), cutting
 * origin latency; the Next.js cache still fronts every request.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  token: process.env.SANITY_API_READ_TOKEN,
  perspective: "published",
  // A hung request fails instead of holding a render until the Worker limit.
  timeout: 10_000,
});
