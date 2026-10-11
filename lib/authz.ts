import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  showEmail?: boolean;
  [key: string]: unknown;
};

/** Current session user, or null. Use in public / optional-auth paths. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  return (session?.user as SessionUser) ?? null;
}

/**
 * The RLS replacement. Every server action / route handler touching user-owned
 * data MUST call this and filter queries by the returned `id`. Throws 401 if
 * unauthenticated.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

/** How recent a sign-in must be for account-level changes. */
const FRESH_SESSION_MS = 15 * 60 * 1000;

/**
 * The user, only if they signed in within the last 15 minutes — required for
 * irreversible or account-takeover-relevant actions (delete account, add a
 * password), so a stolen or forgotten-open session can't perform them.
 * Returns "stale" when signed in earlier; the UI asks to sign in again.
 */
export async function requireFreshUser(): Promise<SessionUser | "stale"> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Response("Unauthorized", { status: 401 });
  const signedInAt = new Date(session.session.createdAt).getTime();
  if (Date.now() - signedInAt > FRESH_SESSION_MS) return "stale";
  return session.user as SessionUser;
}
