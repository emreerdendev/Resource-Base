"use server";

import { headers } from "next/headers";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getAuth } from "@/lib/auth";
import { getSessionUser, isVerified, requireFreshUser, requireUser } from "@/lib/authz";
import { isRateLimited, overLimit } from "@/lib/rate-limit";
import { cleanSocialLinks } from "@/lib/social-links";
import { isReservedUsername, isValidUsername } from "@/lib/username";

const PW_MIN = 8;
const PW_MAX = 64;

/**
 * Set a password for the CURRENT user when they don't have one yet (signed up
 * via OAuth only). Better Auth's setPassword is server-only, so it's wrapped
 * here. Rejected if the user already has a credential account — they must use
 * changePassword (which requires the current password) instead, so this can't
 * be used to overwrite an existing password without knowing it.
 */
export async function setMyPassword(
  newPassword: string,
): Promise<{ error: string | null }> {
  // Adding a password creates a login that outlives every session, so it
  // needs a recent sign-in, not just any open session.
  if ((await requireFreshUser()) === "stale") return { error: "reauth" };
  if (
    typeof newPassword !== "string" ||
    newPassword.length < PW_MIN ||
    newPassword.length > PW_MAX
  )
    return { error: "invalid_password" };

  const auth = await getAuth();
  const hdrs = await headers();

  const accounts = await auth.api.listUserAccounts({ headers: hdrs });
  const hasCredential = (accounts ?? []).some(
    (a: { providerId?: string }) => a.providerId === "credential",
  );
  if (hasCredential) return { error: "password_exists" };

  await auth.api.setPassword({ body: { newPassword }, headers: hdrs });
  return { error: null };
}


const EDITABLE = ["fullName", "bio", "socialLinks", "showEmail"] as const;

/** Validate + set a unique username (replaces set_username RPC). Own row only. */
export async function setUsername(
  next: string,
): Promise<{ error: string | null }> {
  const me = await requireUser();
  if (!isVerified(me)) return { error: "unverified" };
  if (typeof next !== "string") return { error: "invalid_username" };
  // Case is kept as typed; it never makes a name distinct (see lib/username).
  const cleaned = next.trim();
  if (!isValidUsername(cleaned)) return { error: "invalid_username" };
  if (isReservedUsername(cleaned)) return { error: "reserved_username" };
  // A human changes their handle rarely; cap at 5/hour to stop a script from
  // hammering the uniqueness query + write. Far above any real use.
  if (await isRateLimited(`username:${me.id}`, 5, 3600))
    return { error: "rate_limited" };

  const db = getDb();
  const clash = await db
    .select({ id: user.id })
    .from(user)
    .where(and(sql`lower(${user.username}) = ${cleaned.toLowerCase()}`, ne(user.id, me.id)))
    .limit(1);
  if (clash.length > 0) return { error: "username_taken" };

  try {
    await db.update(user).set({ username: cleaned }).where(eq(user.id, me.id));
  } catch (e) {
    if (String(e).includes("UNIQUE")) return { error: "username_taken" };
    throw e;
  }
  return { error: null };
}

/** Read the current user's own profile row (own only). */
export async function getMyProfile() {
  const me = await getSessionUser();
  if (!me) return null;
  const db = getDb();
  const [row] = await db.select().from(user).where(eq(user.id, me.id)).limit(1);
  return row ?? null;
}

// Server-side length caps (anti-abuse — never trust the client).
const MAX_LEN: Record<string, number> = {
  fullName: 60,
  bio: 280,
};

/** Update editable profile fields (own only). Caps lengths server-side. */
export async function updateProfile(
  fields: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const me = await requireUser();
  if (!isVerified(me)) return { error: "unverified" };
  if (!fields || typeof fields !== "object") return { error: "invalid" };
  if (await overLimit("RL_USER", `profile:${me.id}`)) return { error: "rate_limited" };
  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (!(key in fields)) continue;
    const raw = fields[key] ?? null;
    if (key === "showEmail") {
      if (typeof raw !== "boolean") return { error: "invalid" };
      patch[key] = raw;
      continue;
    }
    // Links render as <a href> on the public profile: known platforms only,
    // each a valid http(s) link on that platform's own domain.
    if (key === "socialLinks") {
      const links = cleanSocialLinks(raw);
      if (links === "invalid") return { error: "invalid_url" };
      patch[key] = Object.keys(links).length ? links : null;
      continue;
    }
    if (raw !== null && typeof raw !== "string") return { error: "invalid" };
    const v = raw?.trim() || null;
    if (v && v.length > MAX_LEN[key]) return { error: "too_long" };
    patch[key] = v;
  }
  if (Object.keys(patch).length === 0) return { error: null };
  patch.updatedAt = new Date();
  await getDb().update(user).set(patch).where(eq(user.id, me.id));
  return { error: null };
}
