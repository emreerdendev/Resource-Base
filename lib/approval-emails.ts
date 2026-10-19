import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, submissions, user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { approvalEmail } from "@/lib/email-templates";
import { siteUrl } from "@/lib/site";

/**
 * Email the contributors whose new resource or company was approved — next
 * to the in-app notification. One attempt per approval: it's marked before
 * sending, so it's never sent twice, and one that couldn't go out (daily cap,
 * per-address limit) is simply skipped; the notification already told them.
 * `sanityId` limits it to that approval (the webhook); without it, every
 * approval never attempted yet (the admin trigger). Returns how many were sent.
 */
export async function sendApprovalEmails(opts: { sanityId?: string; limit?: number } = {}): Promise<number> {
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
        opts.sanityId ? eq(submissions.sanitySubmissionId, opts.sanityId) : isNotNull(submissions.sanitySubmissionId),
      ),
    )
    .limit(opts.limit ?? 10);

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
  }
  return sent;
}
