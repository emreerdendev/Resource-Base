import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  user,
  favorites,
  submissions,
  notifications,
  companyApplications,
  cvs,
  cvLikes,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * GDPR/KVKK data portability: returns all of the signed-in user's data as a
 * downloadable JSON file. Every query is explicitly filtered by the session
 * user id (the app-level authz that replaces RLS).
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return new NextResponse("Unauthorized", { status: 401 });

  const db = getDb();
  const [profileRows, favRows, subRows, notifRows, appRows, cvRows, cvLikeRows] = await Promise.all([
    db.select().from(user).where(eq(user.id, me.id)).limit(1),
    db.select().from(favorites).where(eq(favorites.userId, me.id)),
    db.select().from(submissions).where(eq(submissions.userId, me.id)),
    db.select().from(notifications).where(eq(notifications.userId, me.id)),
    db
      .select()
      .from(companyApplications)
      .where(eq(companyApplications.userId, me.id)),
    db.select().from(cvs).where(eq(cvs.userId, me.id)),
    db.select().from(cvLikes).where(eq(cvLikes.userId, me.id)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: me.id, email: me.email },
    profile: profileRows[0] ?? null,
    favorites: favRows,
    submissions: subRows,
    notifications: notifRows,
    companyApplications: appRows,
    // The PDF itself opens from Edit Profile → CV; this is its listing.
    cv: cvRows[0] ?? null,
    likedCvs: cvLikeRows,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="resource-base-data.json"',
    },
  });
}
