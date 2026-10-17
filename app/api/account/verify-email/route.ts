import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getSessionUser } from "@/lib/authz";
import { isRateLimited } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

/**
 * Send the signed-in user a new verification link (the "verify your email"
 * banner). Signed-in only, so it needs no captcha; limited to 3 an hour per
 * user, on top of the per-recipient and daily email limits in lib/email.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.emailVerified === true) return NextResponse.json({ ok: true, verified: true });
  if (await isRateLimited(`verify-resend:${user.id}`, 3, 3600))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const auth = await getAuth();
  await auth.api.sendVerificationEmail({
    body: { email: user.email, callbackURL: "/" },
    headers: await headers(),
  });
  return NextResponse.json({ ok: true });
}
