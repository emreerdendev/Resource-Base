"use server";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { companyApplications } from "@/lib/db/schema";
import { getSessionUser, requireUser } from "@/lib/authz";
import { isRateLimited } from "@/lib/rate-limit";
import {
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/company-taxonomy";

export type TrackedCompany = {
  companyId: string;
  status: ApplicationStatus;
  note: string | null;
  updatedAt: string;
};

const NOTE_MAX = 1000;
const COMPANY_ID_RE = /^company-[a-z0-9-]{1,96}$|^[A-Za-z0-9-]{8,64}$/;

/** Every company the signed-in user tracks (own rows only). */
export async function listTrackedCompanies(): Promise<TrackedCompany[]> {
  const me = await getSessionUser();
  if (!me) return [];
  const rows = await getDb()
    .select()
    .from(companyApplications)
    .where(eq(companyApplications.userId, me.id))
    .orderBy(desc(companyApplications.updatedAt));
  return rows.map((r) => ({
    companyId: r.companyId,
    status: isApplicationStatus(r.status) ? r.status : "saved",
    note: r.note,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

type Result = { ok: true } | { ok: false; error: "rate_limited" | "invalid" };

/**
 * Save / update the user's status for a company. Passing `null` removes the
 * company from their tracker (un-bookmark). Upsert keeps it a single round-trip.
 */
export async function setCompanyStatus(
  companyId: string,
  status: ApplicationStatus | null,
): Promise<Result> {
  const me = await requireUser();
  if (!COMPANY_ID_RE.test(companyId)) return { ok: false, error: "invalid" };
  if (status !== null && !isApplicationStatus(status))
    return { ok: false, error: "invalid" };
  // Far above real use — only trips a script hammering D1 writes.
  if (await isRateLimited(`track:${me.id}`, 60, 60))
    return { ok: false, error: "rate_limited" };

  const db = getDb();
  const own = and(
    eq(companyApplications.userId, me.id),
    eq(companyApplications.companyId, companyId),
  );
  if (status === null) {
    await db.delete(companyApplications).where(own);
    return { ok: true };
  }
  const now = new Date();
  await db
    .insert(companyApplications)
    .values({ userId: me.id, companyId, status, updatedAt: now })
    .onConflictDoUpdate({
      target: [companyApplications.userId, companyApplications.companyId],
      set: { status, updatedAt: now },
    });
  return { ok: true };
}

/** Private note on a tracked company (auto-tracks it as "saved" if needed). */
export async function setCompanyNote(
  companyId: string,
  note: string,
): Promise<Result> {
  const me = await requireUser();
  if (!COMPANY_ID_RE.test(companyId)) return { ok: false, error: "invalid" };
  if (await isRateLimited(`track:${me.id}`, 60, 60))
    return { ok: false, error: "rate_limited" };

  const clean = note.trim().slice(0, NOTE_MAX) || null;
  const now = new Date();
  await getDb()
    .insert(companyApplications)
    .values({ userId: me.id, companyId, note: clean, updatedAt: now })
    .onConflictDoUpdate({
      target: [companyApplications.userId, companyApplications.companyId],
      set: { note: clean, updatedAt: now },
    });
  return { ok: true };
}
