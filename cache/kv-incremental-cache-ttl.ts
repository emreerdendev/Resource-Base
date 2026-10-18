import {
  getCloudflareContext,
  type defineCloudflareConfig,
} from "@opennextjs/cloudflare";
import {
  computeCacheKey,
  debugCache,
} from "@opennextjs/cloudflare/overrides/internal";

// OpenNext's `IncrementalCache` type lives in `@opennextjs/aws`, which pnpm
// nests so app code can't import it directly. Derive it from the config
// parameter instead (`Override<IncrementalCache>` union → the member with `get`).
type IncrementalCacheOverride = NonNullable<
  NonNullable<Parameters<typeof defineCloudflareConfig>[0]>["incrementalCache"]
>;
type IncrementalCache = Extract<IncrementalCacheOverride, { get: unknown }>;

/**
 * OpenNext's bundled `kvIncrementalCache` writes every ISR/SSG page to KV with
 * NO expiration (its source carries a `// TODO: leverage KV's TTL`). Combined
 * with build-id-scoped keys, each deploy strands the previous build's pages in
 * KV forever, so storage grows without bound — that is what ran our KV up to
 * ~24 GB ($0.50/GB-month).
 *
 * This is a drop-in replacement that is identical to the bundled cache except
 * `set()` attaches an `expirationTtl`. Pages still in rotation get rewritten on
 * every revalidation, so the TTL only ever reaps entries nothing is reading
 * anymore (stale builds, dropped routes). `get`/`delete` are unchanged.
 *
 * TTL is 7 days: longer than the 1-day `revalidate` safety net in
 * sanity/lib/fetch.ts, so pages in use are rewritten before they expire, while
 * each deploy's stranded build-id keys are reaped within a week. A miss is just
 * regenerated.
 *
 * Error pages (404s for made-up slugs, 500s) are never stored: each distinct
 * junk URL would otherwise become its own KV write plus a week of storage.
 * But when a page that IS cached comes back as an error (its resource or
 * company was removed), the old entry is deleted: otherwise the removed page
 * kept being served, and re-rendered in the background on every view, until
 * the entry expired.
 *
 * The name is OpenNext's own KV cache name so `opennextjs-cloudflare deploy`
 * loads the build's prerendered pages into KV (it only does that for the
 * names it knows). Those entries carry no TTL; the link-check cron deletes
 * every key of a build that is no longer live.
 */
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const NAME = "cf-kv-incremental-cache";
const BINDING_NAME = "NEXT_INC_CACHE_KV";
const PREFIX_ENV_NAME = "NEXT_INC_CACHE_KV_PREFIX";

type CacheType = "cache" | "fetch" | "composable";
type GetParams = [key: string, cacheType?: CacheType];
type GetReturn = Promise<{ value?: unknown; lastModified: number } | null>;
type SetParams = [key: string, value: unknown, cacheType?: CacheType];

// Not `implements IncrementalCache`: that interface's get/set are generic over
// CacheType and a class can't restate generic method signatures via rest tuples
// cleanly. We type the instance structurally and cast at export instead.
class KVIncrementalCacheWithTtl {
  readonly name = NAME;

  async get(...[key, cacheType]: GetParams): GetReturn {
    const kv = getCloudflareContext().env[BINDING_NAME];
    if (!kv) throw new Error("No KV Namespace");
    debugCache("KVIncrementalCacheWithTtl", `get ${key}`);
    try {
      const entry = await kv.get<Record<string, unknown>>(
        this.getKVKey(key, cacheType),
        "json",
      );
      if (!entry) return null;
      if ("lastModified" in entry) {
        return entry as { value?: unknown; lastModified: number };
      }
      // No lastModified => written during build-time cache population.
      return {
        value: entry,
        lastModified: (globalThis as Record<string, unknown>)
          .__BUILD_TIMESTAMP_MS__ as number,
      };
    } catch (e) {
      console.error("Failed to get from cache", e);
      return null;
    }
  }

  async set(...[key, value, cacheType]: SetParams): Promise<void> {
    const kv = getCloudflareContext().env[BINDING_NAME];
    if (!kv) throw new Error("No KV Namespace");
    debugCache("KVIncrementalCacheWithTtl", `set ${key}`);
    if (isErrorPage(value)) {
      // A list lookup (not a write) first, so junk URLs cost no KV writes.
      const kvKey = this.getKVKey(key, cacheType);
      try {
        const { keys } = await kv.list({ prefix: kvKey, limit: 1 });
        if (keys.some((k) => k.name === kvKey)) await kv.delete(kvKey);
      } catch (e) {
        console.error("Failed to drop an errored page from cache", e);
      }
      return;
    }
    try {
      await kv.put(
        this.getKVKey(key, cacheType),
        JSON.stringify({ value, lastModified: Date.now() }),
        // The expiration the bundled cache omits — entries expire, not accrue.
        { expirationTtl: TTL_SECONDS },
      );
    } catch (e) {
      console.error("Failed to set to cache", e);
    }
  }

  async delete(key: string) {
    const kv = getCloudflareContext().env[BINDING_NAME];
    if (!kv) throw new Error("No KV Namespace");
    debugCache("KVIncrementalCacheWithTtl", `delete ${key}`);
    try {
      await kv.delete(this.getKVKey(key, "cache"));
    } catch (e) {
      console.error("Failed to delete from cache", e);
    }
  }

  protected getKVKey(key: string, cacheType?: CacheType): string {
    return computeCacheKey(key, {
      prefix: getCloudflareContext().env[PREFIX_ENV_NAME] as string | undefined,
      buildId: process.env.OPEN_NEXT_BUILD_ID,
      cacheType,
    });
  }
}

function isErrorPage(value: unknown): boolean {
  const status = (value as { meta?: { status?: number } } | null)?.meta?.status;
  return typeof status === "number" && status >= 400;
}

// Cast through unknown: the structural shape matches OpenNext's IncrementalCache
// at runtime (same get/set/delete/name), only the generic CacheType signatures
// differ, which is erased at runtime.
export default new KVIncrementalCacheWithTtl() as unknown as IncrementalCache;
