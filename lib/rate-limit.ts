import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageCounters } from "@/lib/db/schema";
import { siteUrl } from "@/lib/site";

/**
 * Abuse limits. Three tools, all free on the Workers Paid plan, and none of
 * them spends KV writes (KV is kept for the page cache only):
 *
 *  - `overLimit`  — Workers Rate Limiting bindings: short windows on hot paths.
 *  - `isRateLimited` / `dailyCapReached` — counters in D1 (one atomic upsert):
 *    long windows per user/recipient, and site-wide daily ceilings that cap
 *    what any amount of traffic can cost (Sanity documents, R2 writes, email).
 *  - `alreadySeen` — the Cache API, for "count once per window" deduping.
 *
 * Limits sit well above real use; they only bite scripts. On an unexpected
 * error they let the request through rather than break the site.
 */

/** Bump `key` (creating it for `windowSec`) and return its new count. */
async function bump(key: string, windowSec: number): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const [row] = await getDb()
    .insert(usageCounters)
    .values({ key, count: 1, expiresAt: now + windowSec })
    .onConflictDoUpdate({
      target: usageCounters.key,
      set: { count: sql`${usageCounters.count} + 1` },
    })
    .returning({ count: usageCounters.count });
  // Prune stale windows now and then (about 1 in 200 calls).
  if (Math.random() < 0.005) {
    await getDb().delete(usageCounters).where(lt(usageCounters.expiresAt, now)).catch(() => {});
  }
  return row?.count ?? 1;
}

/**
 * Returns true if `key` is OVER its limit for the current window (caller should
 * reject). Fixed windows: the key is bucketed by window so it resets itself.
 *
 * @param key       unique bucket, e.g. `submit-day:<userId>`
 * @param max       max actions allowed per window
 * @param windowSec window length in seconds
 */
export async function isRateLimited(key: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const window = Math.floor(Date.now() / 1000 / windowSec);
    return (await bump(`rl:${key}:${window}`, windowSec + 60)) > max;
  } catch (err) {
    console.error("rate limit check failed", err);
    return false;
  }
}

/**
 * Site-wide daily ceiling for `name` (UTC day). Returns true once `max` uses
 * were counted today — the circuit breaker that keeps bots from turning
 * traffic into cost. Counts the attempt it allows.
 */
export async function dailyCapReached(name: string, max: number): Promise<boolean> {
  try {
    const day = new Date().toISOString().slice(0, 10);
    return (await bump(`cap:${name}:${day}`, 2 * 86400)) > max;
  } catch (err) {
    console.error("daily cap check failed", err);
    return false;
  }
}

/**
 * "Count this once per window" (e.g. one click per IP and resource a day):
 * true if `key` was already seen (skip), false the first time (proceed).
 * Kept in the Workers Cache API — free and per data center, which is plenty
 * for deduping counts.
 */
export async function alreadySeen(key: string, windowSec: number): Promise<boolean> {
  try {
    const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
    if (!cache) return false; // local dev → always count
    // A URL on our own zone, so the entry lives in this site's cache.
    const url = `${siteUrl}/__dedupe/${encodeURIComponent(key)}`;
    if (await cache.match(url)) return true;
    await cache.put(url, new Response("1", { headers: { "Cache-Control": `max-age=${windowSec}` } }));
    return false;
  } catch {
    return false;
  }
}

/**
 * Emergency switches, flipped from the Cloudflare dashboard (Worker →
 * Settings → Variables) without a code change: SUBMISSIONS_PAUSED,
 * UPLOADS_PAUSED, SIGNUPS_PAUSED ("1" = paused).
 */
export function isPaused(flag: "SUBMISSIONS_PAUSED" | "UPLOADS_PAUSED"): boolean {
  try {
    return (getCloudflareContext().env as unknown as Record<string, string | undefined>)[flag] === "1";
  } catch {
    return false;
  }
}

/** Site-wide daily ceilings (see dailyCapReached). Far above real use. */
export const DAILY_CAPS = {
  /** New Sanity documents from users (keeps the free plan's 10k documents safe). */
  submissions: 150,
  /** CV uploads (R2 writes + a Sanity document each). */
  cvUploads: 50,
  /** Avatar changes (R2 writes). */
  avatars: 200,
} as const;

type Limiter = "RL_PUBLIC" | "RL_USER" | "RL_SUBMIT";

/**
 * Short-window limit on a Workers Rate Limiting binding (see wrangler.jsonc for
 * each binding's limit/period). Unlike `isRateLimited` it costs nothing — no KV
 * read or write per call — so it's the one to use on hot paths. Counters are
 * per Cloudflare location and approximate, which is fine for abuse limiting.
 * Returns true when the caller should reject. Allows when the binding is
 * missing (local dev) or errors.
 */
export async function overLimit(limiter: Limiter, key: string): Promise<boolean> {
  try {
    const rl = getCloudflareContext().env[limiter] as RateLimit | undefined;
    if (!rl) return false;
    return !(await rl.limit({ key })).success;
  } catch {
    return false;
  }
}

export { clientIp } from "@/lib/client-ip";
