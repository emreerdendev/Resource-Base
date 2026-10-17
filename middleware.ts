import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isProtectedPage } from "@/lib/protected-routes";

/** API routes that require a signed-in user. */
const PROTECTED_APIS = ["/api/submit", "/api/user"];

/**
 * Outermost defense layer. LIGHTWEIGHT session-cookie existence check only — no
 * DB round-trip (authoritative auth lives in the server actions / route handlers
 * via requireUser()). Public browsing stays open; account-only pages/APIs need a
 * session cookie.
 *
 * NOTE: kept as `middleware.ts` (not Next 16's `proxy.ts`) because
 * @opennextjs/cloudflare doesn't yet support the proxy convention (issue #962).
 */
export function middleware(request: NextRequest) {
  // www → apex, so crawlers don't index (and we don't serve) every page twice.
  // A Cloudflare Redirect Rule does this before the Worker runs; this is the
  // fallback if that rule is missing.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }

  const hasSession = !!getSessionCookie(request);
  const { pathname } = request.nextUrl;

  if (!hasSession) {
    if (PROTECTED_APIS.some((p) => pathname.startsWith(p))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (isProtectedPage(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      // Remember the destination so signing in continues there.
      url.search = `?auth=required&next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets, the Studio, the auth API
  // (Better Auth manages its own), and the cron route.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
