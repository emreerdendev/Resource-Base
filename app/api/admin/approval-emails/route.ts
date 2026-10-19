import { type NextRequest, NextResponse } from "next/server";
import { sendApprovalEmails } from "@/lib/approval-emails";
import { getSessionUser } from "@/lib/authz";
import { isAdminEmail } from "@/lib/cv-files";
import { isSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

/**
 * Admins only: send the approval emails that haven't gone out yet (approvals
 * from before these emails existed, or ones a daily cap held back). They also
 * go out on the next approval; this sends them now.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const me = await getSessionUser();
  if (!me || !isAdminEmail(me.email)) return new NextResponse("Not found", { status: 404 });
  const sent = await sendApprovalEmails(25);
  return NextResponse.json({ sent });
}
