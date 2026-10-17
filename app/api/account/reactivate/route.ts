import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { clientIp, dailyCapReached, overLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { writeClient } from "@/sanity/lib/writeClient";

export const runtime = "nodejs";

/**
 * A suspended account asks to be reactivated (it can't sign in, so this is
 * public). It becomes an "Account request" in the Studio; approving it gives
 * the account another 7 days to verify (/api/notify). Guarded by Turnstile, a
 * per-IP limit and a daily ceiling, and it answers the same whether or not a
 * suspended account exists — so it can't be used to probe for accounts.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const ip = clientIp(req.headers);
  if (await overLimit("RL_PUBLIC", `reactivate:${ip}`))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { email?: unknown; message?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!(await verifyTurnstile(body.token, ip))) return NextResponse.json({ error: "captcha" }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
  if (!email.includes("@")) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const ok = NextResponse.json({ ok: true });

  const [account] = await getDb()
    .select({ id: user.id, username: user.username, suspendedAt: user.suspendedAt })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email))
    .limit(1);
  if (!account?.suspendedAt) return ok;
  if (await dailyCapReached("reactivations", 50)) return ok;

  const open = await writeClient.fetch<string | null>(
    `*[_type == "accountRequest" && userId == $id && status == "pending"][0]._id`,
    { id: account.id },
  );
  if (open) return ok;
  await writeClient.create({
    _type: "accountRequest",
    email,
    userId: account.id,
    username: account.username ?? "",
    message,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return ok;
}
