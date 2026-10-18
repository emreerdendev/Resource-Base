import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { favorites, resourceClicks } from "@/lib/db/schema";
import type { ResourceCounts } from "@/lib/types";
import { inBackground } from "@/lib/server-timing";

export const runtime = "nodejs";

/** Shared by every visitor, so a few minutes of staleness is fine. */
const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

/**
 * Public click + favorite counts for resource cards. Served from the Workers
 * Cache API (free, per data center), so the two table reads run at most once
 * per location every 5 minutes instead of on every page view.
 */
export async function GET(req: NextRequest) {
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const key = new Request(new URL("/api/counts", req.url));
  const hit = await cache?.match(key);
  if (hit) return hit;

  const db = getDb();
  const [clickRows, favoriteRows] = await Promise.all([
    db.select({ id: resourceClicks.resourceId, count: resourceClicks.count }).from(resourceClicks),
    db
      .select({ id: favorites.resourceId, count: sql<number>`count(*)` })
      .from(favorites)
      .groupBy(favorites.resourceId),
  ]);
  const body: ResourceCounts = {
    clicks: Object.fromEntries(clickRows.map((r) => [r.id, Number(r.count)])),
    favorites: Object.fromEntries(favoriteRows.map((r) => [r.id, Number(r.count)])),
  };
  const res = NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
  // Stored after the response; a failed write never fails the request.
  if (cache) inBackground(cache.put(key, res.clone()).catch(() => {}));
  return res;
}
