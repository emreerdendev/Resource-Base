"use server";

import { and, eq } from "drizzle-orm";
import { getSessionUser, isVerified, requireUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { recountLikes } from "@/lib/cv-like-count";
import { forgetCvList } from "@/lib/cv-list-cache";
import { cvLikes, cvs } from "@/lib/db/schema";
import { overLimit } from "@/lib/rate-limit";

const ID_RE = /^[0-9a-f-]{36}$/;

/** Ids of the CVs the signed-in user liked (own rows only). */
export async function listLikedCvIds(): Promise<string[]> {
  const me = await getSessionUser();
  if (!me) return [];
  const rows = await getDb()
    .select({ cvId: cvLikes.cvId })
    .from(cvLikes)
    .where(eq(cvLikes.userId, me.id));
  return rows.map((r) => r.cvId);
}

/**
 * Like / unlike a published CV (never your own). The count lives on the CV
 * row and moves in the same D1 batch as the like itself.
 */
export async function toggleCvLike(
  cvId: string,
  /** The state the user asked for (see toggleFavorite). */
  want?: boolean,
): Promise<{ liked: boolean; error?: "rate_limited" | "invalid" | "unverified" }> {
  const me = await requireUser();
  if (!isVerified(me)) return { liked: false, error: "unverified" };
  if (typeof cvId !== "string" || !ID_RE.test(cvId)) return { liked: false, error: "invalid" };
  const db = getDb();
  const own = and(eq(cvLikes.userId, me.id), eq(cvLikes.cvId, cvId));
  const [existing] = await db.select({ cvId: cvLikes.cvId }).from(cvLikes).where(own).limit(1);
  if (typeof want === "boolean" && want === Boolean(existing)) return { liked: want };
  if (await overLimit("RL_USER", `cv-like:${me.id}`))
    return { liked: Boolean(existing), error: "rate_limited" };

  if (existing) {
    await db.batch([db.delete(cvLikes).where(own), recountLikes(db, cvId)]);
    await forgetCvList();
    return { liked: false };
  }
  const [cv] = await db
    .select({ userId: cvs.userId, status: cvs.status })
    .from(cvs)
    .where(eq(cvs.id, cvId))
    .limit(1);
  if (!cv || cv.status !== "published" || cv.userId === me.id) return { liked: false, error: "invalid" };
  await db.batch([
    db.insert(cvLikes).values({ userId: me.id, cvId }).onConflictDoNothing(),
    recountLikes(db, cvId),
  ]);
  // The cached list shows like counts: refresh it here so the next load is right.
  await forgetCvList();
  return { liked: true };
}


export type MyCv = {
  id: string;
  title: string;
  field: string;
  seniority: string;
  language: string;
  technologies: string[];
  summary: string | null;
  fileSize: number;
  status: string;
  rejectionReason: string | null;
  likeCount: number;
  updatedAt: string;
};

/** The signed-in user's own CV, in any status. */
export async function getMyCv(): Promise<MyCv | null> {
  const me = await getSessionUser();
  if (!me) return null;
  const [cv] = await getDb().select().from(cvs).where(eq(cvs.userId, me.id)).limit(1);
  if (!cv) return null;
  return {
    id: cv.id,
    title: cv.title,
    field: cv.field,
    seniority: cv.seniority,
    language: cv.language,
    technologies: cv.technologies,
    summary: cv.summary,
    fileSize: cv.fileSize,
    status: cv.status,
    rejectionReason: cv.rejectionReason,
    likeCount: cv.likeCount,
    updatedAt: cv.updatedAt.toISOString(),
  };
}

/** Unlist / relist your published CV (no re-review needed to relist). */
export async function setCvListed(listed: boolean): Promise<{ ok: boolean }> {
  const me = await requireUser();
  if (!isVerified(me)) return { ok: false };
  if (typeof listed !== "boolean") return { ok: false };
  if (await overLimit("RL_USER", `cv-list:${me.id}`)) return { ok: false };
  const [from, to] = listed ? ["hidden", "published"] : ["published", "hidden"];
  await getDb()
    .update(cvs)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(cvs.userId, me.id), eq(cvs.status, from)));
  await forgetCvList();
  return { ok: true };
}
