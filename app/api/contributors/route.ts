import { type NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { submissions, user } from "@/lib/db/schema";
import type { PublicProfileCompact } from "@/lib/types";

export const runtime = "nodejs";

/** Shared by every visitor; a new contributor shows up within minutes. */
const CACHE_CONTROL = "public, max-age=300, s-maxage=600";

/**
 * Everyone credited on the site ("Added by @username"): users with at least
 * one approved submission, by id. One small list for all visitors, served from
 * the Workers Cache API — the D1 query runs at most once per location every
 * 10 minutes, whatever the traffic. The cache key ignores the query string,
 * so it can't be bypassed with "?x=random".
 */
export async function GET(req: NextRequest) {
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const key = new Request(new URL("/api/contributors", req.url));
  const hit = await cache?.match(key);
  if (hit) return hit;

  const rows = await getDb()
    .selectDistinct({
      id: user.id,
      username: user.username,
      full_name: user.fullName,
      avatar_url: user.image,
    })
    .from(user)
    .innerJoin(submissions, eq(submissions.userId, user.id))
    .where(and(eq(submissions.status, "approved"), isNotNull(user.username)));
  const body: Record<string, PublicProfileCompact> = {};
  for (const r of rows) body[r.id] = r as PublicProfileCompact;

  const res = NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
  await cache?.put(key, res.clone());
  return res;
}
