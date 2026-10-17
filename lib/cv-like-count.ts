import "server-only";

import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { cvLikes, cvs } from "@/lib/db/schema";

/**
 * Set a CV's stored like count from its likes, rather than adding or
 * subtracting one: a double click or two tabs can't push it off.
 */
export function recountLikes(db: ReturnType<typeof getDb>, cvId: string) {
  return db
    .update(cvs)
    .set({ likeCount: sql`(select count(*) from ${cvLikes} where ${cvLikes.cvId} = ${cvId})` })
    .where(eq(cvs.id, cvId));
}
