import { type NextRequest, NextResponse } from "next/server";
import { sendApprovalEmails } from "@/lib/approval-emails";
import { getSessionUser } from "@/lib/authz";
import { isAdminEmail } from "@/lib/cv-files";
import { sendEmail } from "@/lib/email";
import { approvalEmail } from "@/lib/email-templates";
import { isSameOrigin } from "@/lib/request";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

/**
 * Admins only: send the approval email for approvals that never had one
 * attempted (those from before these emails existed). One attempt each.
 *
 * `{ "test": true }` instead sends a sample approval email to the signed-in
 * admin's own address, to see it in a real inbox. Nothing else is touched.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const me = await getSessionUser();
  if (!me || !isAdminEmail(me.email)) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json().catch(() => null)) as { test?: unknown } | null;
  if (body?.test === true) {
    const mail = approvalEmail({ kind: "resource", name: "Sample Resource", url: `${siteUrl}/resources` });
    // The per-recipient limits still apply (one every 2 minutes, 5 a day).
    const result = await sendEmail({ to: me.email, ...mail, subject: `[Test] ${mail.subject}`, dedupeKey: me.email });
    return NextResponse.json({ to: me.email, ...result });
  }

  const sent = await sendApprovalEmails({ limit: 25 });
  return NextResponse.json({ sent });
}
