import "server-only";

import { headers } from "next/headers";

const edgeCache = () => (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;

/** The Cache API key /api/cvs is stored under for a given origin. */
export const cvListKey = (origin: string) => new Request(new URL("/api/cvs", origin));

/**
 * Drop the cached CV list in this data center after the owner lists, unlists,
 * replaces or deletes their CV, so they see the change right away. Other data
 * centers catch up when their copy expires (s-maxage, 5 minutes).
 */
export async function forgetCvList(origin?: string) {
  const cache = edgeCache();
  if (!cache) return;
  const base = origin ?? `https://${(await headers()).get("host")}`;
  await cache.delete(cvListKey(base)).catch(() => {});
}
