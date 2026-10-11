import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { resourceClicks } from "@/lib/db/schema";
import { alreadySeen, clientIp, overLimit } from "@/lib/rate-limit";
import { isResourceId } from "@/sanity/lib/slugs";

export const runtime = "nodejs";

// Dedup: same IP+resource counts at most once per window. Backed by KV (shared
// across Worker isolates and persistent), so — unlike an in-memory Map — it
// can't be reset by forcing a cold start. This is what stops a bot inflating a
// resource's click count / trending rank by hammering the public endpoint; the
// link itself still opens, only the COUNT is debounced. The user never notices.
const CLICK_DEDUP_WINDOW_SEC = 24 * 60 * 60; // 24 hours

/**
 * Public, so every check that costs nothing runs before the ones that do:
 * the per-IP limit (free binding) → the id must be a published resource
 * (cached list, so junk ids never become D1 rows) → the KV dedup → the write.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (await overLimit("RL_PUBLIC", `click:${ip}`)) {
    return NextResponse.json({ counted: false }, { status: 429 });
  }

  let resourceId: unknown;
  try {
    ({ resourceId } = (await req.json()) as { resourceId?: unknown });
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (!(await isResourceId(resourceId))) {
    return new NextResponse("Unknown resource", { status: 400 });
  }
  const id = resourceId as string;

  if (await alreadySeen(`click:${ip}:${id}`, CLICK_DEDUP_WINDOW_SEC)) {
    return NextResponse.json({ counted: false });
  }

  try {
    // Atomic UPSERT — replaces the increment_click() RPC.
    await getDb()
      .insert(resourceClicks)
      .values({ resourceId: id, count: 1, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: resourceClicks.resourceId,
        set: { count: sql`${resourceClicks.count} + 1`, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("click increment failed", error);
    return new NextResponse("Server error", { status: 500 });
  }
  return NextResponse.json({ counted: true });
}
