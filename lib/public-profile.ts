import "server-only";

import { cache } from "react";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import type { PublicProfile } from "@/lib/types";

/*
 * Public profile reads. Server-only (not server actions), so they can't be
 * called from outside — the profile page renders with them.
 */

// snake_case projection matching the app's PublicProfile / PublicProfileCompact.
const PUBLIC_COLUMNS = {
  id: user.id,
  username: user.username,
  full_name: user.fullName,
  avatar_url: user.image,
  bio: user.bio,
  social_links: user.socialLinks,
  show_email: user.showEmail,
} as const;

async function fetchPublicProfile(username: string) {
  if (typeof username !== "string" || username.length > 40) return null;
  const db = getDb();
  const [row] = await db
    .select(PUBLIC_COLUMNS)
    .from(user)
    .where(
      and(
        sql`lower(${user.username}) = ${username.toLowerCase()}`,
        isNotNull(user.username),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Email only if the user opted in (replaces public_email RPC). */
export async function fetchPublicEmail(userId: string): Promise<string | null> {
  if (typeof userId !== "string" || userId.length > 64) return null;
  const db = getDb();
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(
      and(
        eq(user.id, userId),
        eq(user.showEmail, true),
        isNotNull(user.username),
      ),
    )
    .limit(1);
  return row?.email ?? null;
}

/** One D1 read per request, shared by the profile layout and page. */
export const getPublicProfile = cache(
  async (username: string) => (await fetchPublicProfile(username)) as PublicProfile | null,
);
