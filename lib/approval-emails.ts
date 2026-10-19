import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, submissions, user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { approvalEmail } from "@/lib/email-templates";
import { siteUrl } from "@/lib/site";

/**
 * Email the contributors whose new resource or company was approved and who
 * haven't had that email yet — next to the in-app notification. Each approval
 * is claimed before sending, so it's emailed once even if two runs overlap;
 * one that couldn't go out (daily cap, per-address limit) is released and
 * retried on a later run. Returns how many were sent.
 */
export async function sendApprovalEmails(limit = 10): Promise<number> {
  const db = getDb();
  const pending = await db
    .select({
      id: submissions.id,
      kind: submissions.kind,
      name: submissions.name,
      sanityId: submissions.sanitySubmissionId,
      email: user.email,
    })
    .from(submissions)
    .innerJoin(user, eq(user.id, submissions.userId))
    .where(
      and(
        eq(submissions.status, "approved"),
        inArray(submissions.kind, ["new", "company"]),
        isNull(submissions.approvalEmailedAt),
        isNotNull(submissions.sanitySubmissionId),
      ),
    )
    .limit(limit);

  let sent = 0;
  for (const row of pending) {
    const claimed = await db
      .update(submissions)
      .set({ approvalEmailedAt: new Date() })
      .where(and(eq(submissions.id, row.id), isNull(submissions.approvalEmailedAt)))
      .returning({ id: submissions.id });
    if (!claimed.length) continue;

    // The live page the approval notification links to.
    const [note] = await db
      .select({ url: notifications.url })
      .from(notifications)
      .where(eq(notifications.sourceKey, `submission_approved:${row.sanityId}`))
      .limit(1);
    const path = note?.url?.startsWith("/") ? note.url : row.kind === "company" ? "/companies" : "/resources";
    const mail = approvalEmail({
      kind: row.kind === "company" ? "company" : "resource",
      name: row.name ?? (row.kind === "company" ? "Your company" : "Your resource"),
      url: `${siteUrl}${path}`,
    });

    const result = await sendEmail({ to: row.email, ...mail, dedupeKey: row.email }).catch(() => ({ ok: false }));
    if (result.ok) sent++;
    else
      await db
        .update(submissions)
        .set({ approvalEmailedAt: null })
        .where(eq(submissions.id, row.id));
  }
  return sent;
}
