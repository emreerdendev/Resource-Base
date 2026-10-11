"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  favorites,
  notifications,
  submissions,
} from "@/lib/db/schema";
import { getSessionUser, requireUser } from "@/lib/authz";
import { overLimit } from "@/lib/rate-limit";
import { isResourceId } from "@/sanity/lib/slugs";

/* ----------------------------- favorites (own) ---------------------------- */

export async function listFavorites(): Promise<string[]> {
  const me = await getSessionUser();
  if (!me) return [];
  const rows = await getDb()
    .select({ resourceId: favorites.resourceId })
    .from(favorites)
    .where(eq(favorites.userId, me.id));
  return rows.map((r) => r.resourceId);
}

export async function toggleFavorite(
  resourceId: string,
): Promise<{ favorited: boolean; error?: "rate_limited" | "invalid" }> {
  const me = await requireUser();
  if (typeof resourceId !== "string" || !/^[A-Za-z0-9._-]{1,100}$/.test(resourceId))
    return { favorited: false, error: "invalid" };
  const db = getDb();
  const where = and(eq(favorites.userId, me.id), eq(favorites.resourceId, resourceId));
  const [existing] = await db
    .select({ resourceId: favorites.resourceId })
    .from(favorites)
    .where(where)
    .limit(1);
  // Per-user ceiling well above real use — only trips a script spamming D1
  // writes. Returns the current state unchanged on trip.
  if (await overLimit("RL_USER", `fav:${me.id}`))
    return { favorited: Boolean(existing), error: "rate_limited" };

  if (existing) {
    await db.delete(favorites).where(where);
    return { favorited: false };
  }
  // Only published resources can be added, so the table (and the public
  // counts every visitor loads) can't fill with made-up ids.
  if (!(await isResourceId(resourceId))) return { favorited: false, error: "invalid" };
  await db.insert(favorites).values({ userId: me.id, resourceId });
  return { favorited: true };
}

/* --------------------------- notifications (own) -------------------------- */

export type NotificationRow = {
  id: string;
  title: string | null;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(): Promise<NotificationRow[]> {
  const me = await getSessionUser();
  if (!me) return [];
  const rows = await getDb()
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      url: notifications.url,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    read_at: r.readAt ? r.readAt.toISOString() : null,
    created_at: r.createdAt.toISOString(),
  }));
}

/** Mark every unread notification of the signed-in user as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const me = await requireUser();
  if (await overLimit("RL_USER", `notif:${me.id}`)) return;
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
}

/* ---------------------------- submissions (own) --------------------------- */

export type SubmissionRow = {
  id: string;
  sanity_submission_id: string | null;
  kind: string;
  target_resource_id: string | null;
  name: string | null;
  url: string | null;
  status: string;
  suggested_category: string | null;
  pricing: string | null;
  tags: string[];
  proposed_categories: string[];
  proposed_tags: string[];
  proposed_description: string | null;
  original_categories: string[];
  original_tags: string[];
  original_description: string | null;
  note: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

export async function listSubmissions(): Promise<SubmissionRow[]> {
  const me = await getSessionUser();
  if (!me) return [];
  const rows = await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.userId, me.id))
    .orderBy(desc(submissions.createdAt));
  return rows.map((r) => ({
    id: r.id,
    sanity_submission_id: r.sanitySubmissionId,
    kind: r.kind,
    target_resource_id: r.targetResourceId,
    name: r.name,
    url: r.url,
    status: r.status,
    suggested_category: r.suggestedCategory,
    pricing: r.pricing,
    tags: r.tags,
    proposed_categories: r.proposedCategories,
    proposed_tags: r.proposedTags,
    proposed_description: r.proposedDescription,
    original_categories: r.originalCategories,
    original_tags: r.originalTags,
    original_description: r.originalDescription,
    note: r.note,
    rejection_reason: r.rejectionReason,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));
}
