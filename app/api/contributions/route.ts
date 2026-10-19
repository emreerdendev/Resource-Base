import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cvs, submissions, user } from "@/lib/db/schema";
import { inBackground } from "@/lib/server-timing";
import type { ContributorEntry } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Shared by every visitor for a minute (browser and edge), so a new
 * contribution shows up within about a minute while the query still runs at
 * most once a minute per location, whatever the traffic.
 */
const CACHE_CONTROL = "public, max-age=60, s-maxage=60";

/**
 * Everyone who has contributed, with what: approved submissions of every
 * kind (new resources and companies, fixes, category/tag and company edits)
 * plus a listed CV. Most contributions first. One small list for all
 * visitors, kept in the Workers Cache API (the key ignores the query string).
 */
export async function GET(req: NextRequest) {
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const key = new Request(new URL("/api/contributions", req.url));
  const hit = await cache?.match(key);
  if (hit) return hit;

  const db = getDb();
  const active = and(isNotNull(user.username), isNull(user.suspendedAt));
  const [bySubmission, byCv] = await Promise.all([
    db
      .select({
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        avatar_url: user.image,
        resources: sql<number>`sum(case when ${submissions.kind} = 'new' then 1 else 0 end)`,
        companies: sql<number>`sum(case when ${submissions.kind} = 'company' then 1 else 0 end)`,
        edits: sql<number>`sum(case when ${submissions.kind} in ('fix', 'taxonomy', 'companyEdit') then 1 else 0 end)`,
      })
      .from(submissions)
      .innerJoin(user, eq(user.id, submissions.userId))
      .where(and(eq(submissions.status, "approved"), active))
      .groupBy(user.id),
    db
      .select({
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        avatar_url: user.image,
        cvs: count(),
      })
      .from(cvs)
      .innerJoin(user, eq(user.id, cvs.userId))
      .where(and(eq(cvs.status, "published"), active))
      .groupBy(user.id),
  ]);

  const byId = new Map<string, ContributorEntry>();
  const entry = (r: { id: string; username: string | null; full_name: string | null; avatar_url: string | null }) => {
    let e = byId.get(r.id);
    if (!e) {
      e = { username: r.username ?? "", full_name: r.full_name, avatar_url: r.avatar_url, resources: 0, companies: 0, edits: 0, cvs: 0, total: 0 };
      byId.set(r.id, e);
    }
    return e;
  };
  for (const r of bySubmission) {
    const e = entry(r);
    e.resources = Number(r.resources) || 0;
    e.companies = Number(r.companies) || 0;
    e.edits = Number(r.edits) || 0;
  }
  for (const r of byCv) entry(r).cvs = Number(r.cvs) || 0;

  const body = [...byId.values()]
    .map((e) => ({ ...e, total: e.resources + e.companies + e.edits + e.cvs }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total || (a.full_name || a.username).localeCompare(b.full_name || b.username));

  const res = NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
  // Stored after the response; a failed write never fails the request.
  if (cache) inBackground(cache.put(key, res.clone()).catch(() => {}));
  return res;
}
