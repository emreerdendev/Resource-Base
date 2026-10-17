import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cvLikes, cvs, user } from "@/lib/db/schema";
import { recountLikes } from "@/lib/cv-like-count";
import { cvBucket } from "@/lib/cv-files";
import { deleteAvatarFile } from "@/lib/avatar";
import { getAuth } from "@/lib/auth";
import { requireFreshUser } from "@/lib/authz";
import { isSameOrigin } from "@/lib/request";
import { writeClient } from "@/sanity/lib/writeClient";

export const runtime = "nodejs";

/**
 * GDPR/KVKK right to erasure: permanently deletes the signed-in user's account
 * and all associated data. Identity comes from the verified session (never the
 * body), so a user can only delete their own account.
 *
 * Order: anonymize the user's Sanity submission docs, then delete the user row
 * — which cascades sessions/favorites/notifications/company applications/CVs
 * (on-delete-cascade FKs) and
 * sets submissions.user_id to null. Published resources stay; submitter
 * attribution is cleared.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  let me;
  try {
    me = await requireFreshUser();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (me === "stale") return NextResponse.json({ error: "reauth" }, { status: 403 });

  let body: { confirm?: string };
  try {
    body = (await req.json()) as { confirm?: string };
  } catch {
    return new NextResponse("Invalid body", { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return new NextResponse("Confirmation required", { status: 400 });
  }

  const userId = me.id;

  // 1) Anonymize this user's Sanity documents (best-effort): their
  //    submissions, and the attribution on resources they contributed.
  try {
    await writeClient
      .transaction()
      .patch({ query: `*[_type == "submission" && submittedBy == $uid]`, params: { uid: userId } }, (p) =>
        p.unset(["submittedBy", "email"]),
      )
      .patch({ query: `*[_type == "resource" && submittedBy == $uid]`, params: { uid: userId } }, (p) =>
        p.unset(["submittedBy"]),
      )
      .patch({ query: `*[_type == "company" && submittedBy == $uid]`, params: { uid: userId } }, (p) =>
        p.unset(["submittedBy"]),
      )
      .commit();
  } catch (err) {
    console.error("sanity anonymize failed", err);
  }

  // 2) Delete the user row (cascades sessions, favorites, notifications, the
  //    tracker and the CV row; nulls submissions.user_id), then the CV file and
  //    a hosted avatar in R2 — only once the row that points at them is gone.
  const db = getDb();
  const [cv] = await db.select({ fileKey: cvs.fileKey }).from(cvs).where(eq(cvs.userId, userId)).limit(1);
  const [row] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1);
  // CVs this user liked: their counts drop once the likes cascade away.
  const liked = await db.select({ cvId: cvLikes.cvId }).from(cvLikes).where(eq(cvLikes.userId, userId));
  try {
    await db.delete(user).where(eq(user.id, userId));
  } catch (err) {
    console.error("user delete failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
  if (cv) await cvBucket().delete(cv.fileKey).catch((err) => console.error("cv file delete failed", err));
  await deleteAvatarFile(row?.image);
  for (const { cvId } of liked) await recountLikes(db, cvId).catch(() => {});

  // 3) Sign the now-orphaned session out (clears cookies).
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // session already invalid (user gone) — ignore
  }

  return NextResponse.json({ ok: true });
}
