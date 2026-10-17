import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionCookie } from "better-auth/cookies";
import { clientIp } from "@/lib/client-ip";
import { isProtectedPage } from "@/lib/protected-routes";

/** Filters of the old resource browser at "/" (see the redirect below). */
const LEGACY_BROWSE_PARAMS = ["category", "tags", "pricing", "lang", "sort"];

/** Mirrors AUTH_HINT_COOKIE in lib/auth-hint.ts (a client module). */
const AUTH_HINT_COOKIE = "rb_auth";

/**
 * Per-IP limit on a Workers Rate Limiting binding (free, no storage). Lets the
 * request through if the binding is missing (local dev) or errors.
 */
async function overIpLimit(binding: "RL_GLOBAL" | "RL_AUTH", request: NextRequest): Promise<boolean> {
  try {
    const rl = (getCloudflareContext().env as unknown as Record<string, RateLimit | undefined>)[binding];
    if (!rl) return false;
    return !(await rl.limit({ key: clientIp(request.headers) })).success;
  } catch {
    return false;
  }
}

const tooMany = () =>
  new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } });

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
export async function middleware(request: NextRequest) {
  // www → apex, so crawlers don't index (and we don't serve) every page twice.
  // A Cloudflare Redirect Rule does this before the Worker runs; this is the
  // fallback if that rule is missing.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;

  // "/" used to be the resource browser: forward its old filtered links
  // (/?category=…&tags=…) to /resources. Done here rather than as a
  // next.config redirect: OpenNext matched those `has: query` conditions on
  // every request, sending the home page itself to /resources.
  if (pathname === "/" && LEGACY_BROWSE_PARAMS.some((k) => request.nextUrl.searchParams.has(k))) {
    const url = request.nextUrl.clone();
    url.pathname = "/resources";
    return NextResponse.redirect(url, 308);
  }

  // Abuse shield: a client sending more than a person ever could is turned
  // away here, before any render, query or Sanity request is spent on it.
  if (await overIpLimit("RL_GLOBAL", request)) return tooMany();
  // Better Auth handles its own routes (and has stricter D1 limits on the
  // email/sign-up ones); this only caps raw volume per IP.
  if (pathname.startsWith("/api/auth")) {
    return (await overIpLimit("RL_AUTH", request)) ? tooMany() : NextResponse.next();
  }

  const hasSession = !!getSessionCookie(request);

  if (!hasSession) {
    if (PROTECTED_APIS.some((p) => pathname.startsWith(p))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (isProtectedPage(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      // Remember the destination so signing in continues there.
      url.search = `?auth=required&next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return syncAuthHint(request, NextResponse.redirect(url), false);
    }
  }
  return syncAuthHint(request, NextResponse.next(), hasSession);
}

/**
 * Keep the readable "signed in" hint (lib/auth-hint.ts) in step with the real
 * session cookie, so the browser only asks for a session when there is one.
 */
function syncAuthHint(request: NextRequest, response: NextResponse, hasSession: boolean) {
  const hinted = request.cookies.get(AUTH_HINT_COOKIE)?.value === "1";
  if (hasSession && !hinted) {
    response.cookies.set(AUTH_HINT_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  } else if (!hasSession && hinted) {
    response.cookies.delete(AUTH_HINT_COOKIE);
  }
  return response;
}

export const config = {
  // Run on everything except static assets (served without the Worker logic).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
