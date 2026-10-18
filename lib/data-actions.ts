"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  favorites,
  notifications,
  submissions,
} from "@/lib/db/schema";
import { getSessionUser, isVerified, requireUser } from "@/lib/authz";
import { overLimit } from "@/lib/rate-limit";
import { isResourceId } from "@/sanity/lib/slugs";
import { writeClient } from "@/sanity/lib/writeClient";
import type { CompanyEditFields } from "@/lib/company-edit";
import type { Company, Resource } from "@/lib/types";

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

/**
 * Favorite or unfavorite a resource. `want` is the state the user asked for,
 * so a click from a stale screen sets that state instead of flipping whatever
 * is saved; the result is always the saved state.
 */
export async function toggleFavorite(
  resourceId: string,
  want?: boolean,
): Promise<{ favorited: boolean; error?: "rate_limited" | "invalid" | "unverified" }> {
  const me = await requireUser();
  if (!isVerified(me)) return { favorited: false, error: "unverified" };
  if (typeof resourceId !== "string" || !/^[A-Za-z0-9._-]{1,100}$/.test(resourceId))
    return { favorited: false, error: "invalid" };
  const db = getDb();
  const where = and(eq(favorites.userId, me.id), eq(favorites.resourceId, resourceId));
  const [existing] = await db
    .select({ resourceId: favorites.resourceId })
    .from(favorites)
    .where(where)
    .limit(1);
  if (typeof want === "boolean" && want === Boolean(existing)) return { favorited: want };
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
  // A double click can race past the check above; the second insert is a no-op.
  await db.insert(favorites).values({ userId: me.id, resourceId }).onConflictDoNothing();
  return { favorited: true };
}

/* --------------------------- notifications (own) -------------------------- */

export type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, string> | null;
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
      type: notifications.type,
      data: notifications.data,
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
    type: r.type,
    data: r.data ?? null,
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
  proposed_name: string | null;
  proposed_url: string | null;
  propose_removal: boolean;
  original_categories: string[];
  original_tags: string[];
  original_description: string | null;
  proposed_fields: CompanyEditFields | null;
  original_fields: CompanyEditFields | null;
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
    proposed_name: r.proposedName,
    proposed_url: r.proposedUrl,
    propose_removal: r.proposeRemoval,
    original_categories: r.originalCategories,
    original_tags: r.originalTags,
    original_description: r.originalDescription,
    proposed_fields: r.proposedFields ?? null,
    original_fields: r.originalFields ?? null,
    note: r.note,
    rejection_reason: r.rejectionReason,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));
}

/**
 * Withdraw a pending submission or clear a rejected one: removes it from the
 * Sanity review queue and from the user's list. Approved submissions are live
 * and stay. Own rows only.
 */
export async function withdrawSubmission(
  id: string,
): Promise<{ ok: true } | { ok: false; error: "invalid" | "approved" | "rate_limited" }> {
  const me = await requireUser();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "invalid" };
  if (await overLimit("RL_USER", `withdraw:${me.id}`)) return { ok: false, error: "rate_limited" };
  const db = getDb();
  const own = and(eq(submissions.id, id), eq(submissions.userId, me.id));
  const [row] = await db
    .select({ status: submissions.status, sanityId: submissions.sanitySubmissionId })
    .from(submissions)
    .where(own)
    .limit(1);
  if (!row) return { ok: false, error: "invalid" };
  if (row.status === "approved") return { ok: false, error: "approved" };
  if (row.sanityId) {
    // Re-check in Sanity: an editor may have approved it a moment ago.
    const doc = await writeClient.fetch<{ status?: string; submittedBy?: string } | null>(
      `*[_type == "submission" && _id == $id][0]{ status, submittedBy }`,
      { id: row.sanityId },
    );
    if (doc?.status === "approved") return { ok: false, error: "approved" };
    if (doc && doc.submittedBy === me.id) await writeClient.delete(row.sanityId);
  }
  await db.delete(submissions).where(own);
  return { ok: true };
}

/* --------------------------- resubmit a rejection -------------------------- */

export type ResubmitContext =
  | {
      kind: "taxonomy";
      resource: Resource;
      proposal: {
        name: string | null;
        url: string | null;
        description: string | null;
        categories: string[];
        tags: string[];
        removal: boolean;
        note: string | null;
      };
    }
  | { kind: "fix"; resource: Pick<Resource, "_id" | "name" | "url">; url: string | null }
  | {
      kind: "companyEdit";
      company: Company;
      proposed: CompanyEditFields | null;
      removal: boolean;
      note: string | null;
    }
  | {
      kind: "company";
      fields: {
        name: string;
        website: string;
        careerUrl: string;
        linkedin: string;
        emails: string[];
        cities: string[];
        otherLocations: string[];
        workModels: string[];
        note: string;
      };
    }
  | { kind: "gone" };

/**
 * What a rejected suggestion proposed, plus the current state of what it was
 * about, so the user can edit it and send it again. Own rejected submissions
 * only. `gone` when the resource or company no longer exists.
 */
export async function getResubmitContext(sanityId: string): Promise<ResubmitContext | null> {
  const me = await requireUser();
  if (typeof sanityId !== "string" || sanityId.length > 100) return null;
  const [row] = await getDb()
    .select()
    .from(submissions)
    .where(and(eq(submissions.userId, me.id), eq(submissions.sanitySubmissionId, sanityId)))
    .limit(1);
  if (!row || row.status !== "rejected") return null;
  const published = { perspective: "published" as const };

  if (row.kind === "taxonomy" || row.kind === "fix") {
    const resource = await writeClient.fetch<Resource | null>(
      `*[_type == "resource" && _id == $id && submissionStatus == "published"][0]{
        _id, name, url, description, "slug": slug.current,
        "categories": coalesce(categories[]->{ _id, title, "slug": slug.current }, []),
        "tags": coalesce(tags[]->{ _id, title, "slug": slug.current }, [])
      }`,
      { id: row.targetResourceId ?? "" },
      published,
    );
    if (!resource) return { kind: "gone" };
    if (row.kind === "fix") return { kind: "fix", resource, url: row.url };
    return {
      kind: "taxonomy",
      resource,
      proposal: {
        name: row.proposedName,
        url: row.proposedUrl,
        description: row.proposedDescription,
        categories: row.proposedCategories,
        tags: row.proposedTags,
        removal: row.proposeRemoval,
        note: row.note,
      },
    };
  }

  if (row.kind === "companyEdit") {
    const company = await writeClient.fetch<Company | null>(
      `*[_type == "company" && _id == $id && status == "published"][0]{
        _id, name, "slug": slug.current, website, linkedin, description,
        "emails": coalesce(emails, []), "careerLinks": coalesce(careerLinks, []),
        "channels": coalesce(channels, []), "cities": coalesce(cities, []),
        "otherLocations": coalesce(otherLocations, []), "workModels": coalesce(workModels, []),
        "sectors": coalesce(sectors, []), "clients": coalesce(clients, [])
      }`,
      { id: row.targetResourceId ?? "" },
      published,
    );
    if (!company) return { kind: "gone" };
    return { kind: "companyEdit", company, proposed: row.proposedFields ?? null, removal: row.proposeRemoval, note: row.note };
  }

  if (row.kind === "company") {
    const doc = await writeClient.fetch<{
      name?: string;
      companyWebsite?: string;
      companyCareerUrl?: string;
      companyLinkedin?: string;
      companyEmails?: string[];
      companyCities?: string[];
      companyOtherLocations?: string[];
      companyWorkModels?: string[];
      note?: string;
      submittedBy?: string;
    } | null>(
      `*[_type == "submission" && _id == $id][0]{ name, companyWebsite, companyCareerUrl, companyLinkedin, companyEmails, companyCities, companyOtherLocations, companyWorkModels, note, submittedBy }`,
      { id: sanityId },
    );
    if (!doc || doc.submittedBy !== me.id) return null;
    return {
      kind: "company",
      fields: {
        name: doc.name ?? row.name ?? "",
        website: doc.companyWebsite ?? "",
        careerUrl: doc.companyCareerUrl ?? "",
        linkedin: doc.companyLinkedin ?? "",
        emails: doc.companyEmails ?? [],
        cities: doc.companyCities ?? [],
        otherLocations: doc.companyOtherLocations ?? [],
        workModels: doc.companyWorkModels ?? [],
        note: doc.note ?? "",
      },
    };
  }
  return null;
}
