import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getAuth } from "@/lib/auth";
import { getSessionUser } from "@/lib/authz";
import { writeClient } from "@/sanity/lib/writeClient";

export const runtime = "nodejs";

/**
 * GDPR/KVKK right to erasure: permanently deletes the signed-in user's account
 * and all associated data. Identity comes from the verified session (never the
 * body), so a user can only delete their own account.
 *
 * Order: anonymize the user's Sanity submission docs, then delete the user row
 * — which cascades sessions/favorites/notifications/company applications
 * (on-delete-cascade FKs) and
 * sets submissions.user_id to null. Published resources stay; submitter
 * attribution is cleared.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return new NextResponse("Unauthorized", { status: 401 });

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

  // 1) Anonymize this user's Sanity submissions (best-effort).
  try {
    await writeClient
      .patch({
        query: `*[_type == "submission" && submittedBy == $uid]`,
        params: { uid: userId },
      })
      .unset(["submittedBy", "email"])
      .commit();
  } catch (err) {
    console.error("sanity anonymize failed", err);
  }

  // 2) Delete the user row (cascades sessions/favorites/notifications; nulls
  //    submissions.user_id).
  try {
    await getDb().delete(user).where(eq(user.id, userId));
  } catch (err) {
    console.error("user delete failed", err);
    return new NextResponse("Server error", { status: 500 });
  }

  // 3) Sign the now-orphaned session out (clears cookies).
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // session already invalid (user gone) — ignore
  }

  return NextResponse.json({ ok: true });
}
