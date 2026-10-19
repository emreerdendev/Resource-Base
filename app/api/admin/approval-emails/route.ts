import { type NextRequest, NextResponse } from "next/server";
import { sendApprovalEmails } from "@/lib/approval-emails";
import { getSessionUser } from "@/lib/authz";
import { isAdminEmail } from "@/lib/cv-files";
import { isSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

/**
 * Admins only: send the approval email for approvals that never had one
 * attempted (those from before these emails existed). One attempt each.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const me = await getSessionUser();
  if (!me || !isAdminEmail(me.email)) return new NextResponse("Not found", { status: 404 });
  const sent = await sendApprovalEmails({ limit: 25 });
  return NextResponse.json({ sent });
}
