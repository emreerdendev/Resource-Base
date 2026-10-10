/** Page routes that require a signed-in user. Shared by the middleware gate
 *  (server-side, on navigation/refresh) and the auth provider (client-side, so
 *  signing out while on one of these pages bounces home immediately instead of
 *  leaving the now-unauthorized page visible until the next refresh). */
export const PROTECTED_PAGES = [
  "/submit",
  "/favorites",
  "/applications",
  "/notifications",
  "/profile/edit",
];

/** True when a pathname is one of the protected pages (exact or nested). */
export function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
