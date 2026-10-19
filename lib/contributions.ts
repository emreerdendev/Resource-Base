import "server-only";

import { and, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cvs, submissions } from "@/lib/db/schema";

/** What a user has contributed — the same rules as /api/contributions. */
export type ContributionCounts = {
  /** New resources and companies approved. */
  resources: number;
  companies: number;
  /** Approved fixes, category/tag suggestions and company edits. */
  edits: number;
  /** A listed CV (0 or 1). */
  cvs: number;
  total: number;
};

/**
 * One user's contributions: approved submissions of every kind plus a listed
 * CV. Drives the profile badge and count, so they match the Contributions
 * page.
 */
export async function contributionCounts(userId: string): Promise<ContributionCounts> {
  const db = getDb();
  const [[subs], [cv]] = await Promise.all([
    db
      .select({
        resources: sql<number>`sum(case when ${submissions.kind} = 'new' then 1 else 0 end)`,
        companies: sql<number>`sum(case when ${submissions.kind} = 'company' then 1 else 0 end)`,
        edits: sql<number>`sum(case when ${submissions.kind} in ('fix', 'taxonomy', 'companyEdit') then 1 else 0 end)`,
      })
      .from(submissions)
      .where(and(eq(submissions.userId, userId), eq(submissions.status, "approved"))),
    db
      .select({ n: count() })
      .from(cvs)
      .where(and(eq(cvs.userId, userId), eq(cvs.status, "published"))),
  ]);
  const resources = Number(subs?.resources) || 0;
  const companies = Number(subs?.companies) || 0;
  const edits = Number(subs?.edits) || 0;
  const cvCount = Math.min(1, Number(cv?.n) || 0);
  return { resources, companies, edits, cvs: cvCount, total: resources + companies + edits + cvCount };
}
