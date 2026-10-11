"use server";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { companyApplications } from "@/lib/db/schema";
import { getSessionUser, requireUser } from "@/lib/authz";
import { isRateLimited, overLimit } from "@/lib/rate-limit";
import { listCompanyIds } from "@/sanity/lib/slugs";
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

/** Writes only target published companies, so rows per user stay bounded. */
async function isCompanyId(id: unknown): Promise<boolean> {
  return typeof id === "string" && COMPANY_ID_RE.test(id) && (await listCompanyIds()).has(id);
}

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
  // Removing skips the published check so entries of since-hidden companies
  // can still be cleared.
  const valid =
    status === null
      ? typeof companyId === "string" && COMPANY_ID_RE.test(companyId)
      : isApplicationStatus(status) && (await isCompanyId(companyId));
  if (!valid) return { ok: false, error: "invalid" };
  // Far above real use — only trips a script hammering D1 writes.
  if (await overLimit("RL_USER", `track:${me.id}`))
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
  if (typeof note !== "string" || !(await isCompanyId(companyId)))
    return { ok: false, error: "invalid" };
  if (await overLimit("RL_USER", `track:${me.id}`))
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

const IMPORT_MAX = 500;

/**
 * Bulk-add companies to the user's tracker (CSV import). Only matched company
 * ids + statuses reach the server — the file itself is parsed in the browser.
 * "saved" never downgrades an existing entry; other statuses overwrite.
 */
export async function importTrackedCompanies(
  entries: { companyId: string; status: ApplicationStatus }[],
): Promise<{ ok: true; imported: number } | { ok: false; error: "rate_limited" | "invalid" }> {
  const me = await requireUser();
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > IMPORT_MAX)
    return { ok: false, error: "invalid" };
  const published = await listCompanyIds();
  const clean = new Map<string, ApplicationStatus>();
  for (const e of entries) {
    if (!e || !published.has(e.companyId) || !isApplicationStatus(e.status))
      return { ok: false, error: "invalid" };
    clean.set(e.companyId, e.status);
  }
  if (await isRateLimited(`track-import:${me.id}`, 5, 3600))
    return { ok: false, error: "rate_limited" };

  const db = getDb();
  const now = new Date();
  const statements = [...clean].map(([companyId, status]) => {
    const insert = db
      .insert(companyApplications)
      .values({ userId: me.id, companyId, status, updatedAt: now });
    return status === "saved"
      ? insert.onConflictDoNothing()
      : insert.onConflictDoUpdate({
          target: [companyApplications.userId, companyApplications.companyId],
          set: { status, updatedAt: now },
        });
  });
  // D1 batch = one round-trip, applied atomically.
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  return { ok: true, imported: clean.size };
}
