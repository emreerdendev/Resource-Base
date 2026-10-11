import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * KV-backed fixed-window rate limiter. Unlike the per-warm-instance Maps used in
 * some routes, KV is shared across all Worker isolates and survives cold starts,
 * so the limit is a real ceiling — an attacker can't reset it by forcing a new
 * isolate. Best-effort (KV is eventually consistent), which is exactly right for
 * abuse limiting: the window count may be off by one under a burst, never wildly.
 *
 * Limits here are set WELL ABOVE normal human usage — they only ever bite bots /
 * scripted spam. A real user toggling a favorite or editing their profile will
 * never come close, so there's no UX cost and no added latency on the happy path
 * (one KV get + one put, single-digit ms, and the callers run it server-side).
 */
type KvBinding = {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ) => Promise<void>;
};

function getKv(): KvBinding | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as Record<string, unknown>).NEXT_INC_CACHE_KV as
      | KvBinding
      | undefined;
  } catch {
    return undefined; // no CF context (shouldn't happen in routes/actions)
  }
}

/**
 * Returns true if `key` is OVER its limit for the current window (caller should
 * reject), false if it's within limits (caller should proceed). When KV is
 * unavailable (local dev) it always allows — never blocks development.
 *
 * @param key      unique bucket, e.g. `fav:<userId>` or `click:<ip>:<id>`
 * @param max      max actions allowed per window
 * @param windowSec window length in seconds
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const kv = getKv();
  if (!kv) return false; // local/dev → don't block

  // Fixed window: bucket the key by the current window index so it auto-resets.
  const windowIndex = Math.floor(Date.now() / 1000 / windowSec);
  const bucket = `rl:${key}:${windowIndex}`;
  const current = Number((await kv.get(bucket)) ?? "0");
  if (current >= max) return true;
  await kv.put(bucket, String(current + 1), { expirationTtl: windowSec + 60 });
  return false;
}

/**
 * Dedup helper for "count this once per window" semantics (e.g. click counting):
 * returns true if this key was ALREADY seen in the window (caller should skip),
 * false the first time (caller should proceed). Persistent across isolates, so
 * unlike an in-memory Map it isn't reset by cold starts.
 */
export async function alreadySeen(
  key: string,
  windowSec: number,
): Promise<boolean> {
  const kv = getKv();
  if (!kv) return false; // local/dev → always count
  const k = `seen:${key}`;
  if ((await kv.get(k)) !== null) return true;
  await kv.put(k, "1", { expirationTtl: windowSec });
  return false;
}

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

/**
 * The client IP for per-IP limits. IPv6 is cut to its /64 — one subscriber
 * typically owns a whole /64, so per-address limits would be trivial to rotate.
 */
export function clientIp(headers: Headers): string {
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!ip.includes(":")) return ip;
  // Expand "::" so equal /64 prefixes compare equal however they're written.
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":");
}
