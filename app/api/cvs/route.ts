import { type NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cvs, user } from "@/lib/db/schema";
import { cvListKey } from "@/lib/cv-list-cache";
import type { CvListing } from "@/lib/types";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

/**
 * Every published CV's listing details (never the file). Served from the
 * Workers Cache API, so the D1 read runs at most once per data center every
 * 5 minutes; likes made in the meantime are applied optimistically on the client.
 */
export async function GET(req: NextRequest) {
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const key = cvListKey(req.url);
  const hit = await cache?.match(key);
  if (hit) return hit;

  const rows = await getDb()
    .select({
      id: cvs.id,
      title: cvs.title,
      field: cvs.field,
      seniority: cvs.seniority,
      language: cvs.language,
      technologies: cvs.technologies,
      summary: cvs.summary,
      likeCount: cvs.likeCount,
      publishedAt: cvs.publishedAt,
      username: user.username,
      name: user.fullName,
      authName: user.name,
      avatar: user.image,
    })
    .from(cvs)
    .innerJoin(user, eq(user.id, cvs.userId))
    .where(eq(cvs.status, "published"))
    .orderBy(desc(cvs.publishedAt));

  const body: CvListing[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    field: r.field,
    seniority: r.seniority,
    language: r.language,
    technologies: r.technologies,
    summary: r.summary,
    likeCount: r.likeCount,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    owner: { username: r.username, name: r.name || r.authName, avatar: r.avatar },
  }));
  const res = NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
  await cache?.put(key, res.clone());
  return res;
}
