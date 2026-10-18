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
async function overIpLimit(binding: "RL_GLOBAL" | "RL_RSC" | "RL_AUTH", request: NextRequest): Promise<boolean> {
  try {
    const rl = (getCloudflareContext().env as unknown as Record<string, RateLimit | undefined>)[binding];
    if (!rl) return false;
    return !(await rl.limit({ key: clientIp(request.headers) })).success;
  } catch {
    return false;
  }
}

/**
 * 429. A page load gets a small page that reloads itself once the minute is
 * up, instead of bare text; fetches get plain text.
 */
function tooMany(request: NextRequest) {
  const headers = { "Retry-After": "60", "Cache-Control": "no-store" };
  if (request.headers.get("sec-fetch-dest") !== "document")
    return new NextResponse("Too many requests", { status: 429, headers });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="60"><title>Resource Base</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#fbfaff;color:#18181b;text-align:center;padding:16px}@media(prefers-color-scheme:dark){body{background:#0e0e12;color:#f4f4f5}}p{color:#71717a;max-width:28rem}a{color:#7c5cf0}</style></head><body><main><h1>Too many requests</h1><p>This page was requested too often in a short time. It will reload by itself in a minute.</p><p><a href="/">Back home</a></p></main></body></html>`;
  return new NextResponse(html, { status: 429, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

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

  // Signed Sanity webhooks (bulk edits send bursts) and OpenNext's own
  // background page refreshes aren't visitors: they skip the per-IP limits.
  // (The refresh header carries OpenNext's secret preview id, so it can't be
  // faked; the webhook routes reject anything unsigned before doing work.)
  const previewId = process.env.__NEXT_PREVIEW_MODE_ID;
  const internal =
    (!!previewId && request.headers.get("x-prerender-revalidate") === previewId) ||
    pathname === "/api/revalidate" ||
    pathname === "/api/notify";
  if (internal) return NextResponse.next();

  // Abuse shield: a client sending more than a person ever could is turned
  // away here, before any render, query or Sanity request is spent on it.
  // Client-side navigations and prefetches (RSC GETs of pages) come in bursts
  // of several per click, so they have their own, larger budget; page loads,
  // API calls and server actions share the stricter one whatever headers
  // they carry.
  const rsc =
    request.method === "GET" &&
    !pathname.startsWith("/api/") &&
    !request.headers.has("next-action") &&
    (request.headers.has("rsc") || request.nextUrl.searchParams.has("_rsc"));
  if (await overIpLimit(rsc ? "RL_RSC" : "RL_GLOBAL", request)) return tooMany(request);
  // Better Auth handles its own routes (and has stricter D1 limits on the
  // email/sign-up ones); this only caps raw volume per IP. Reading the
  // session (every signed-in page load) isn't counted here: it's a cheap
  // cookie read, and on a shared IP it would lock signed-in users out.
  if (pathname.startsWith("/api/auth") && pathname !== "/api/auth/get-session") {
    return (await overIpLimit("RL_AUTH", request)) ? tooMany(request) : NextResponse.next();
  }
  if (pathname === "/api/auth/get-session") return NextResponse.next();

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
